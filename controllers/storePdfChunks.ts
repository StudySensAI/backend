import { Request, Response } from "express";
import { supabase } from "../supabaseClient.js";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
console.log("📂 loading storePdfChunks");

export const storePdfChunks = async (req: Request, res: Response) => {
  try {
    const { docId, userId } = req.body;

    if (!docId) return res.status(400).json({ error: "Missing docId" });
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", docId)
      .eq("user_id", userId)
      .single();

    if (docError || !doc) {
      console.error(docError);
      return res.status(500).json({ error: "Document not found" });
    }

    const fileUrl = doc.file_url;

    const downloadRes = await fetch(fileUrl);
    const pdfBuffer = Buffer.from(await downloadRes.arrayBuffer());

    const parsed = await pdfParse(pdfBuffer);
    const fullText = parsed.text;

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
    });

    const chunks = await splitter.splitText(fullText);

    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    async function embedText(text: string) {
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
      });
      return embedding.data[0].embedding;
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const embedding = await embedText(chunkText);

      await supabase.from("pdf_chunks").insert({
        document_id: docId,
        user_id: userId,
        chunk_index: i,
        column: chunkText,
        embedding: embedding,
      });
    }

    return res.json({
      message: "PDF chunks stored successfully",
      totalChunks: chunks.length,
    });
  } catch (err: any) {
    console.error("Chunking error:", err);
    return res.status(500).json({ error: err.message });
  }
};

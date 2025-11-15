import { Request, Response } from "express";
import { supabase } from "../supabaseClient.js";
import fs from "fs";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import path from "path";

export const storePdfChunks = async (req: Request, res: Response) => {
  try {
    const { docId, userId } = req.body;

    if (!docId) return res.status(400).json({ error: "Missing docId" });
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // 1️⃣ Fetch document metadata
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", docId)
      .eq("user_id", userId)
      .single();

    if (docError) {
      console.error(docError);
      return res.status(500).json({ error: "Document not found" });
    }

    const fileUrl = doc.file_url;

    // 2️⃣ Download the PDF as a buffer
    const downloadRes = await fetch(fileUrl);
    const pdfBuffer = Buffer.from(await downloadRes.arrayBuffer());

    // 3️⃣ Extract text
    const parsed = await pdfParse(pdfBuffer);
    const fullText = parsed.text;

    // 4️⃣ Chunk the text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
    });

    const chunks = await splitter.splitText(fullText);

    // 5️⃣ Setup OpenAI embeddings
    const openai = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" });

    async function embedText(text: string) {
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
        
      });
      return embedding.data[0].embedding;
    }

    // 6️⃣ Insert chunks into Supabase
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const embedding = await embedText(chunkText);

      await supabase.from("pdf_chunks").insert({
        document_id: docId,
        user_id: userId,
        chunk_index: i,
        chunk: chunkText,
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

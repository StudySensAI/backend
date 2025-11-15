// controllers/pdfChatController.ts
import { Request, Response } from "express";
import OpenAI from "openai";
import { createRetrieverForPdf } from "../utils/pdfRetriever.js";

export const chatWithPdf = async (req: Request, res: Response) => {
  try {
    const { docId, question } = req.body;

    if (!docId) return res.status(400).json({ error: "Missing docId" });
    if (!question) return res.status(400).json({ error: "Missing question" });

    // 1️⃣ Get retriever for the selected PDF
    const retriever = createRetrieverForPdf(docId);

    // 2️⃣ Fetch relevant chunks
    const docs = await retriever._getRelevantDocuments(question);

    const context = docs
      .map((d) => d.pageContent)
      .join("\n\n----------------\n\n");

    // 3️⃣ Build LLM prompt
    const prompt = `
You are an AI that answers strictly using the provided PDF content. 
If the answer is not present in the PDF, say "I cannot find that information in the document."

PDF CONTENT:
${context}

USER QUESTION:
${question}

FINAL ANSWER:
`;

    // 4️⃣ Call OpenRouter LLM (GPT-4.1 / Claude / etc)
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const completion = await client.chat.completions.create({
      model: "openai/gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const answer = completion.choices[0].message.content;

    return res.json({
      answer,
      chunksUsed: docs.length,
    });
  } catch (err: any) {
    console.error("PDF chat error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// retrievers/pdfRetriever.ts
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const sbUrl = process.env.SUPABASE_URL!;
const sbKey = process.env.SUPABASE_API_KEY!;
const client = createClient(sbUrl, sbKey);

const embeddings = new OpenAIEmbeddings({
  model: "openai/text-embedding-3-large",
  apiKey: process.env.OPENROUTER_API_KEY!,
  configuration: { baseURL: "https://openrouter.ai/api/v1" },
});

export function createRetrieverForPdf(documentId: string) {
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "pdf_chunks",
    queryName: "match_pdf_chunks",
    filter: { document_id: documentId },
  });

  return vectorStore.asRetriever({ k: 5 });
}

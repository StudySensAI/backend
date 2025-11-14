import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const openAIApiKey = process.env.OPENROUTER_API_KEY!;
const sbApiKey = process.env.SUPABASE_API_KEY || "";
const sbUrl = process.env.SUPABASE_URL || "";

const client = createClient(sbUrl, sbApiKey);

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
  apiKey: openAIApiKey,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1/",
  },
});

/**
 * Create a retriever for a specific Notion page ID.
 */
export function createRetrieverForPage(pageId: string) {
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client,
    tableName: "page_chunks",
    queryName: "match_documents",
    filter: { pageId },   // <- Must match metadata.pageId
  });

  return vectorStore.asRetriever({
    k: 5,
  });
}

/**
 * Fetch and store Notion page chunks in Supabase
 * Safe, stable, TypeScript-compatible
 */

import { Client as NotionClient } from "@notionhq/client";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

/* --------------------------------------------------
 * Env Validation
 * -------------------------------------------------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_API_KEY || !OPENROUTER_API_KEY) {
  throw new Error("Missing required environment variables.");
}

/* --------------------------------------------------
 * Supabase + Embeddings Client
 * -------------------------------------------------- */
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_API_KEY);

const embeddings = new OpenAIEmbeddings({
  apiKey: OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  model: "text-embedding-3-large",
});

/* --------------------------------------------------
 * Types
 * -------------------------------------------------- */
interface RichTextItem {
  plain_text: string;
}

interface BlockWithRichText {
  rich_text: RichTextItem[];
}

interface BlockObjectResponse {
  id: string;
  type: string;
  [key: string]: any;
}

/* --------------------------------------------------
 * Extract text from Notion blocks
 * -------------------------------------------------- */
function extractText(block: BlockObjectResponse): string {
  const getText = (key: string): string => {
    const richBlock = block[key] as BlockWithRichText | undefined;
    return richBlock?.rich_text?.map(t => t.plain_text).join(" ") ?? "";
  };

  switch (block.type) {
    case "paragraph":
    case "heading_1":
    case "heading_2":
    case "heading_3":
    case "bulleted_list_item":
    case "numbered_list_item":
    case "to_do":
    case "callout":
    case "quote":
      return getText(block.type);
    default:
      return "";
  }
}

/* --------------------------------------------------
 * Fetch Page Title
 * -------------------------------------------------- */
async function getPageName(notion: NotionClient, pageId: string): Promise<string> {
  try {
    const page: any = await notion.pages.retrieve({ page_id: pageId });
    const props = page.properties ?? {};

    const titleProp: any = Object.values(props).find(
      (p: any) => p.type === "title"
    );

    if (!titleProp) return "Untitled Page";

    return titleProp.title.map((t: any) => t.plain_text).join(" ") || "Untitled Page";
  } catch (err) {
    console.error("Failed to get page title:", err);
    return "Untitled Page";
  }
}

/* --------------------------------------------------
 * Fetch Page Content
 * -------------------------------------------------- */
async function getPageContent(
  notion: NotionClient,
  pageId: string
): Promise<string> {
  let blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  try {
    do {
      const res: any = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      });

      blocks = blocks.concat(res.results);
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);

    return blocks.map(extractText).filter(Boolean).join("\n").trim();
  } catch (err) {
    console.error("Failed to fetch page content:", err);
    throw err;
  }
}

/* --------------------------------------------------
 * MAIN FUNCTION — Store Page in Supabase
 * -------------------------------------------------- */
export async function storeInSupabase(
  pageId: string,
  accessToken: string
): Promise<void> {
  console.log("Processing Notion page:", pageId);

  const notion = new NotionClient({ auth: accessToken });

  const [pageName, text] = await Promise.all([
    getPageName(notion, pageId),
    getPageContent(notion, pageId),
  ]);

  if (!text) {
    console.warn("Page content empty.");
    return;
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });

  let docs = await splitter.createDocuments([text], [{ pageName }]);

  // Inject pageId inside metadata
 docs = docs.map(doc => ({
  ...doc,
  metadata: {
    ...doc.metadata,
    pageId,       // <- stored INSIDE metadata, correct
  }
}));


  console.log("Chunks created:", docs.length);

  await SupabaseVectorStore.fromDocuments(docs, embeddings, {
    client: supabase,
    tableName: "page_chunks", // your table
  });

  console.log("Stored in Supabase successfully.");
}

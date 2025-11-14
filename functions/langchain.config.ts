// langchain.config.ts

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";

import { createRetrieverForPage } from "../utils/retriever.js";
import { combineDocuments } from "../utils/combineDocuments.js";
import dotenv from "dotenv";

dotenv.config();

/* --------------------------------------------------
   Type Declarations
-------------------------------------------------- */
interface ChainInput {
  question: string;
  pageId: string;
}

interface StandaloneOutput {
  standalone_question: string;
  original_input: ChainInput;
}

interface RetrieverOutput {
  context: string;
  question: string;
}

/* --------------------------------------------------
   LLM Setup
-------------------------------------------------- */
const openAIApiKey = process.env.OPENROUTER_API_KEY!;
if (!openAIApiKey) throw new Error("Missing OPENROUTER_API_KEY");

const llm = new ChatOpenAI({
  configuration: {
    apiKey: openAIApiKey,
    baseURL: "https://openrouter.ai/api/v1",
  },
});

/* --------------------------------------------------
   Prompts
-------------------------------------------------- */
const standalonePrompt = PromptTemplate.fromTemplate(`
Rewrite the user question into a standalone question with full context.
Question: {question}
Standalone question:
`);

const systemPrompt = `
You are "NotionStudy", an intelligent AI study assistant.
Use only the provided Notion context from Supabase.
If the answer is missing, say you couldn't find it.
Also include a BRIEF summary of what the user asked.
You will never mention "On the user's Notion page" or something like that. Chat as if you're the users tutor.
Try to answer most of the answer in bullet points if possible and also use emojis for better clarification.

`;

const answerPrompt = PromptTemplate.fromTemplate(`
${systemPrompt}

Context from the user's Notion page:
{context}

Question:
{question}

Answer:
`);

/* --------------------------------------------------
   Chains
-------------------------------------------------- */

// 1️⃣ Standalone question chain
const standaloneChain = standalonePrompt.pipe(llm).pipe(new StringOutputParser());

// 2️⃣ Retriever chain
const retrieverChain = RunnableSequence.from<
  StandaloneOutput,
  string
>([
  {
    context: async (input) => {
      const retriever = createRetrieverForPage(input.original_input.pageId);
      const docs = await retriever.invoke(input.standalone_question);
      console.log("retrieved docs",docs)
      return combineDocuments(docs);
    },
  },
  (output: { context: string }) => output.context,
]);

// 3️⃣ Final answer chain
const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser());

/* --------------------------------------------------
   FINAL PIPELINE
-------------------------------------------------- */
export const chain = RunnableSequence.from<ChainInput, string>([
  // STEP 1 → standalone question
  {
    standalone_question: (input) => standaloneChain.invoke({ question: input.question })
,
    original_input: new RunnablePassthrough<ChainInput>(),
  },

  // STEP 2 → retrieve relevant documents
  {
    context: retrieverChain,
    question: (input) => input.original_input.question,
  },

  // STEP 3 → generate final answer
  answerChain,
]);

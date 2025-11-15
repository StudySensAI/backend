// controllers/pdfChatController.ts
import { Request, Response } from "express";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createRetrieverForPdf } from "../utils/pdfRetriever.js";
import { combineDocuments } from "../utils/combineDocuments.js";

console.log("📂 loading pdfChatController");

/* ----------------------------------------------
   TYPES
------------------------------------------------*/
interface ChainInput {
  question: string;
  docId: string;
}

interface StandaloneOutput {
  standalone_question: string;
  original_input: ChainInput;
}

/* ----------------------------------------------
   LLM SETUP
------------------------------------------------*/
const llm = new ChatOpenAI({
  configuration: {
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: "https://openrouter.ai/api/v1",
  },
  modelName: "openai/gpt-4o-mini", // small + cheap + safe
  temperature: 0.2,
});

/* ----------------------------------------------
   PROMPTS
------------------------------------------------*/
const standalonePrompt = PromptTemplate.fromTemplate(`
Rewrite the user's question into a standalone question with full context.
Question: {question}
Standalone question:
`);

const systemPrompt = `
You are "StudySensAI", a PDF-based AI tutor.
You MUST answer ONLY using the PDF content provided.
If the answer is not found, say:
"I cannot find that information in the document."

Enhance clarity with bullet points + emojis.
`;

const answerPrompt = PromptTemplate.fromTemplate(`
${systemPrompt}

PDF CONTENT:
{context}

QUESTION:
{question}

FINAL ANSWER:
`);

/* ----------------------------------------------
   CHAINS
------------------------------------------------*/

// STEP 1 → Standalone question
const standaloneChain = standalonePrompt
  .pipe(llm)
  .pipe(new StringOutputParser());

// STEP 2 → Retrieve chunks from PDF
const retrieverChain = RunnableSequence.from<
  StandaloneOutput,
  string
>([
  async (input: StandaloneOutput) => {
    const retriever = createRetrieverForPdf(input.original_input.docId);
    console.log("retrived", retriever)
    console.log("parameter", input.original_input.docId)

    // Use the official retriever API
    const docs = await retriever._getRelevantDocuments(
      input.standalone_question
    );
    console.log('docs', docs)

    return {
      context: combineDocuments(docs),
      question: input.standalone_question,
    };
  },

  // Final output = just the context string
  (output) => output.context,
]);

// STEP 3 → Answer generation
const answerChain = answerPrompt
  .pipe(llm)
  .pipe(new StringOutputParser());

/* ----------------------------------------------
   FINAL PIPELINE
------------------------------------------------*/
const pdfChain = RunnableSequence.from<ChainInput, string>([
  {
    standalone_question: (input) =>
      standaloneChain.invoke({ question: input.question }),
    original_input: new RunnablePassthrough<ChainInput>(),
  },

  // Retrieve context
  {
    context: retrieverChain,
    question: (i) => i.original_input.question,
  },

  // Generate final answer
  answerChain,
]);

/* ----------------------------------------------
   CONTROLLER HANDLER
------------------------------------------------*/
export const chatWithPdf = async (req: Request, res: Response) => {
  try {
    const { docId, question } = req.body;

    if (!docId) return res.status(400).json({ error: "Missing docId" });
    if (!question) return res.status(400).json({ error: "Missing question" });

    const answer = await pdfChain.invoke({ docId, question });

    return res.json({
      answer,
    });
  } catch (err: any) {
    console.error("PDF chat error:", err);
    return res.status(500).json({ error: err.message });
  }
};

import express from "express";
import { chain } from "../functions/langchain.config.js"; // your full pipeline
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
console.log("pdfchatroute loaded4")

router.post("/query", async (req, res) => {
  try {
    const { userId, pageId, question } = req.body;

    if (!userId || !pageId || !question) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 🔥 Force page resolver chain to use exact pageId
    const finalAnswer = await chain.invoke({
      question,
      pageId: pageId, // override resolver
    });

    res.json({ answer: finalAnswer });
  } catch (err: any) {
    console.error("Chat Query Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

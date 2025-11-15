// routes/pdfChatRoutes.ts
import express from "express";
import { chatWithPdf } from "../controllers/pdfChatController.js";
console.log("pdfchatroute loaded1")
console.log("📂 loading pdfChatRoutes");

const router = express.Router();

router.post("/pdf-query", chatWithPdf);

export default router;

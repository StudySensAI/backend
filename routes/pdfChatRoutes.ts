// routes/pdfChatRoutes.ts
import express from "express";
import { chatWithPdf } from "../controllers/pdfChatController.js";

const router = express.Router();

router.post("/pdf-query", chatWithPdf);

export default router;

import express from "express";
import { storePdfChunks } from "../controllers/storePdfChunks.js";

const router = express.Router();
console.log("pdfchatroute loaded3")

// THIS ROUTE RECEIVES userId + docId
router.post("/store-chunks", storePdfChunks);

export default router;
console.log("📂 loading docRoutes");

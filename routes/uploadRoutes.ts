import express from "express";
import { upload, uploadPDF } from "../controllers/uploadController.js";

const router = express.Router();

// use the multer instance FROM uploadController (memoryStorage)
router.post("/upload-pdf", upload.single("file"), uploadPDF);

export default router;

import express from "express";
import multer from "multer";
import { uploadPDF } from "../controllers/uploadController.js";
import { deleteUpload } from "../controllers/deleteUpload.js";
import { generateDownloadUrl } from "../controllers/downloadController.js";


const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Route: POST /api/upload-pdf
router.post("/upload-pdf", upload.single("file"), uploadPDF);
router.delete("/delete-document", deleteUpload);
router.post("/download-url", generateDownloadUrl);
export default router;

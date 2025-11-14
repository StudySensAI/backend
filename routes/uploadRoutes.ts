import express from "express";
import multer from "multer";
import { uploadPDF } from "../controllers/uploadController";
import { deleteUpload } from "../controllers/deleteUpload";
import { generateDownloadUrl } from "../controllers/downloadController";


const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Route: POST /api/upload-pdf
router.post("/upload-pdf", upload.single("file"), uploadPDF);
router.delete("/delete-document", deleteUpload);
router.post("/download-url", generateDownloadUrl);
export default router;

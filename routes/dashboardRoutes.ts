import express from "express";
import { getDocuments } from "../controllers/getDocuments.js";

const router = express.Router();
router.get("/documents", getDocuments);


export default router;
import express from "express";
import { getDocuments } from "../controllers/getDocuments";

const router = express.Router();
router.get("/documents", getDocuments);


export default router;
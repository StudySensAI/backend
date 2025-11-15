import { Request, Response } from "express";
import { supabase } from "../supabaseClient.js";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(),
});

export const uploadPDF = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { user_id, title } = req.body;

    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!user_id) return res.status(400).json({ error: "User ID is required" });

    const fileName = `${Date.now()}_${file.originalname}`;

    // -------------------------
    // PDF PAGE COUNT (CORRECT)
    // -------------------------
    let pageCount = 0;
    try {
      const pdfData = await pdfParse(file.buffer);  // ✔️ correct input
      pageCount = pdfData.numpages || 0;
    } catch (err) {
      console.error("Error reading PDF for page count:", err);
    }

    // -------------------------
    // Upload to Supabase
    // -------------------------
    const { error: uploadError } = await supabase.storage
      .from("pdfs")
      .upload(fileName, file.buffer, {
        contentType: "application/pdf",
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData.publicUrl;

    const { data: insertedDoc, error: insertError } = await supabase
      .from("documents")
      .insert([
        {
          title: title || file.originalname,
          file_url: fileUrl,
          user_id,
          pages: pageCount,
        },
      ])
      .select("*")
      .single();

    if (insertError)
      return res.status(500).json({ error: insertError.message });

    return res.status(200).json({
      message: "File uploaded successfully",
      document: insertedDoc,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

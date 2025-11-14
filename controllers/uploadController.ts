import { Request, Response } from "express";
import { supabase } from "../supabaseClient.js";
import fs from "fs";
import path from "path";
import pdf from "pdf-parse/lib/pdf-parse.js";

/**
 * ⛔ VERY IMPORTANT FOR RENDER:
 * Multer MUST store files in /tmp (Render's only writable folder)
 *
 * If your multer config is NOT already:
 * multer({ dest: "/tmp" })
 * then CHANGE IT NOW.
 *
 * Otherwise req.file.path will point to a non-writable directory and
 * fs.readFileSync will fail → upload will fail → Supabase upload will fail.
 */

export const uploadPDF = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { user_id, title } = req.body; // Expecting user_id and optional title in the request body

    // ------------------------------
    // VALIDATION
    // ------------------------------
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}_${file.originalname}`;

    const filePath = file.path;

    // Debug logs (useful for Render)
    console.log("UPLOAD RECEIVED:");
    console.log("Original name:", file.originalname);
    console.log("Temp path:", filePath);
    console.log("Exists on disk?:", fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      return res
        .status(500)
        .json({ error: "Temporary file not found on server (Render fs issue)" });
    }

    // ------------------------------
    // PAGE COUNT (pdf-parse)
    // ------------------------------
    let pageCount = 0;
    try {
      const fileBufferForCount = fs.readFileSync(filePath);
      const pdfData = await pdf(fileBufferForCount); // works now
      pageCount = pdfData.numpages || 0;
    } catch (err) {
      console.error("Error reading PDF for page count:", err);
      pageCount = 0;
    }

    // ------------------------------
    // READ FILE AS BUFFER
    // REQUIRED for Supabase + Render
    // ------------------------------
    const fileBuffer = fs.readFileSync(filePath);

    // ------------------------------
    // UPLOAD TO SUPABASE STORAGE
    // ------------------------------
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("pdfs") // ensure bucket name EXACTLY matches
      .upload(fileName, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    console.log("Supabase upload successful:", uploadData);

    // ------------------------------
    // GENERATE PUBLIC URL
    // ------------------------------
    const { data: publicUrlData } = supabase.storage
  .from("pdfs")
  .getPublicUrl(fileName);

const fileUrl = publicUrlData.publicUrl;



    // Additional debug log
    console.log("PUBLIC URL GENERATED:", fileUrl);

    // ------------------------------
    // INSERT INTO DATABASE
    // ------------------------------
    const { data: insertedDoc, error: insertError } = await supabase
      .from("documents")
      .insert([
        {
          title: title || file.originalname, // if title not given, use file name
          file_url: fileUrl,
          user_id: user_id,
          pages: pageCount, // page count (optional)
        },
      ])
      .select("*")
      .single();

    if (insertError) {
      console.error("Error inserting document into database:", insertError);

      // Clean orphaned file in storage
      try {
        await supabase.storage.from("pdfs").remove([fileName]);
      } catch (cleanupErr) {
        console.error("Failed to remove uploaded file after DB insert error:", cleanupErr);
      }

      return res.status(500).json({ error: insertError.message });
    }

    // ------------------------------
    // REMOVE TEMPORARY FILE
    // ------------------------------
    try {
      fs.unlinkSync(filePath);
      console.log("Temporary file removed:", filePath);
    } catch (e) {
      console.warn("Failed to remove temp file (not fatal):", e);
    }

    // ------------------------------
    // SUCCESS RESPONSE
    // ------------------------------
    return res.status(200).json({
      message: "File uploaded successfully",
      document: insertedDoc,
      url: fileUrl, // 👈 REQUIRED
    });
  } catch (err:any) {
    console.error("Upload error:", err);

    return res.status(500).json({
      error: "Internal server error",
      detail: err?.message,
    });
  }
};

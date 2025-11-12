import { Request, Response } from "express";
import { supabase } from "../supabaseClient";
import fs from "fs";
import path from "path";

export const uploadPDF = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}_${file.originalname}`;
    const filePath = file.path;

    // Upload to Supabase storage bucket "pdfs"
    const { data, error } = await supabase.storage
      .from("pdfs")
      .upload(fileName, fs.createReadStream(filePath), {
        contentType: "application/pdf",
      });

    // Remove local file
    fs.unlinkSync(filePath);

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Generate public URL
    const { data: publicUrlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(fileName);

    return res.status(200).json({
      message: "File uploaded successfully",
      url: publicUrlData.publicUrl,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

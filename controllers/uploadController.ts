import { Request, Response } from "express";
import { supabase } from "../supabaseClient";
import fs from "fs";
import path from "path";
const pdf = require("pdf-parse");





export const uploadPDF = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { user_id, title } = req.body; // Expecting user_id and optional title in the request body
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}_${file.originalname}`;
    const filePath = file.path;

    let pageCount = 0;
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(fileBuffer); // works now
      pageCount = pdfData.numpages || 0;
    } catch (err) {
      console.error("Error reading PDF for page count:", err);
      pageCount = 0;
    }






    // Upload to Supabase storage bucket "pdfs"
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("pdfs")
      .upload(fileName, fs.createReadStream(filePath), {
        contentType: "application/pdf",
      });

    // Remove local file
    fs.unlinkSync(filePath);

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    // Generate public URL
    const { data: publicUrlData } = supabase.storage
      .from("pdfs")
      .getPublicUrl(fileName);
    const fileUrl = publicUrlData.publicUrl;

    const { data: insertedDoc, error: insertError } = await supabase
      .from("documents")
      .insert([
        {
          title: title || file.originalname, // if title not given, use file name
          file_url: fileUrl,
          user_id: user_id,
          pages: pageCount, // optional — can add page count later
        },
      ])
      .select("*")
      .single();

    if (insertError) {
      console.error("Error inserting document into database:", insertError);
      return res.status(500).json({ error: insertError.message });
    }


    return res.status(200).json({
      message: "File uploaded successfully",
      document: insertedDoc,
    });


  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

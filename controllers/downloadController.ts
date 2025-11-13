import { Request, Response } from "express";
import { supabase } from "../supabaseClient";

export const generateDownloadUrl = async (req: Request, res: Response) => {
  try {
    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "fileUrl is required" });
    }

    // Extract filename
    const fileName = fileUrl.split("/").pop();

    if (!fileName) {
      return res.status(400).json({ error: "Invalid file URL" });
    }

    // Generate signed URL that forces download
    const { data, error } = await supabase.storage
      .from("pdfs")
      .createSignedUrl(fileName, 60, { download: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ url: data.signedUrl });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

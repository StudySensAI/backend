import { Request, Response } from "express";
import { supabase } from "../supabaseClient.js";

export const deleteUpload = async (req: Request, res: Response) => {
  try {
    const { id, file_url, user_id } = req.body;

    if (!id || !file_url || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Extract filename from the URL
    const parts = file_url.split("/");
    const fileName = parts[parts.length - 1];

    // 1️⃣ Delete file from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .remove([fileName]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      return res.status(500).json({ error: storageError.message });
    }

    // 2️⃣ Delete record from Supabase Database
    const { error: dbError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user_id);

    if (dbError) {
      console.error("DB delete error:", dbError);
      return res.status(500).json({ error: dbError.message });
    }

    return res.status(200).json({
      message: "Document deleted successfully",
      deleted_id: id,
    });

  } catch (err) {
    console.error("Delete upload error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

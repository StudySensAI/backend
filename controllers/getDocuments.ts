import { Request, Response } from "express";
import { supabase } from "../supabaseClient";

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user_id)
      .order("uploaded_at", { ascending: false }) // newest first
      .limit(5);

    if (error) {
      console.error("Error fetching documents:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ documents: data });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

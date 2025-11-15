import express, { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { storeInSupabase } from "../functions/storeToSupabase.js"; // <-- IMPORTANT
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
console.log("pdfchatroute loaded6")

// --------------------------------------------------
// Setup Supabase client
// --------------------------------------------------
const SUPABASE = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_API_KEY!
);

// --------------------------------------------------
// POST /notion/store
// --------------------------------------------------
// This route takes:
//   - userId
//   - pageId
// It loads the user's stored access token,
// then runs your storeInSupabase ingestion.
// --------------------------------------------------
router.post(
  "/notion/store",
  async (
    req: Request<
      {},
      {},
      {
        userId?: string;
        pageId?: string;
      }
    >,
    res: Response
  ) => {
    try {
      const { userId, pageId } = req.body;

      if (!userId || !pageId) {
        return res
          .status(400)
          .json({ error: "Missing userId or pageId in body" });
      }

      // --------------------------------------------------
      // Fetch user's stored Notion Access Token
      // --------------------------------------------------
      const { data: connRow, error: connErr } = await SUPABASE
        .from("notion_connections")
        .select("access_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (connErr || !connRow) {
        console.error("❌ Failed to fetch user token:", connErr);
        return res
          .status(400)
          .json({ error: "No access token found. Connect Notion first." });
      }

      const accessToken = connRow.access_token as string;

      // --------------------------------------------------
      // Run ingestion
      // --------------------------------------------------
      console.log(`⚙️ Starting ingestion for page ${pageId} (user: ${userId})`);

      await storeInSupabase(pageId, accessToken);

      return res.json({
        success: true,
        message: "Page content stored successfully",
        pageId,
      });
    } catch (err: any) {
      console.error("❌ /notion/store error:", err);
      return res
        .status(500)
        .json({ error: err.message ?? "Internal server error" });
    }
  }
);

export default router;

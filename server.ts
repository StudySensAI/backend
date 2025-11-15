import pdfChatRoutes from "./routes/pdfChatRoutes.js";

import chatRoute from "./routes/chatRoutes.js";
import { MyOAuthProvider } from "./notion-config/oauth-provider.js";
import { createClient } from "@supabase/supabase-js";
import notionStoreRoute from './routes/store-routes.js'
import { v4 as uuidv4 } from "uuid";
import express, { Application, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors, { CorsOptions } from "cors";
import path from "path";
import uploadRoutes from "./routes/uploadRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import docRoutes from './routes/docRoutes.js'
dotenv.config();

const app: Application = express();

const front_url=process.env.FRONT_URL
// Middleware to parse JSON
const corsOptions: CorsOptions = {
  origin:[ `${front_url}`,/\.vercel\.app$/], // fallback for safety
  methods: ["GET", "POST", "PUT", "DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.use(express.json());

// ✅ Setup CORS configuration

app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/rag", docRoutes)

app.use("/chat", pdfChatRoutes);

// app.use("/api/v1/auth", (req: Request, res: Response) => {
//   res.send("Auth route working");
// });

// app.use("/api/v1/dashboard", (req: Request, res: Response) => {
//   res.send("Dashboard route working");
// });

// app.use("/api/v1/users", (req: Request, res: Response) => {
//   res.send("Users route working");
// });

// ✅ Error handling middleware (optional but good practice)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

const STATE_TTL_SECONDS = 60 * 10;
const back_url=process.env.BACK_URL
const PORT = parseInt(process.env.PORT || "3001", 10);
const REDIRECT_URL = process.env.REDIRECT_URL || `${back_url}/oauth/callback`;
const SUPABASE = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_API_KEY!);
app.use("/", notionStoreRoute);
app.post("/oauth/start", async (req, res) => {
  const { userId } = req.body;


  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }
  const state = uuidv4();
    const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString();

    // store state in Supabase
    const { error: insertErr } = await SUPABASE
      .from("oauth_states")
      .insert({ state, user_id: userId, expires_at: expiresAt });
    if (insertErr) {
      console.error("Failed to insert oauth state:", insertErr);
      return res.status(500).json({ error: "Failed to create oauth state" });
    }



const notionOAuth = new MyOAuthProvider({
  redirectUrl: REDIRECT_URL,
  scope: "mcp:read mcp:write",
  userId:userId || "",
  supabaseClient: SUPABASE
});
  const authUrl = notionOAuth.generateAuthUrl(state);
res.json({ auth_url: authUrl });




})





app.get("/oauth/callback", async (req: Request, res: Response): Promise<void> => {
     const { code, state } = req.query as { code?: string; state?: string };

    if (!state) {
       res.status(400).send("Missing state");
    }

  try {
    const { data: stateRow, error } = await SUPABASE
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();
         const userId = stateRow.user_id as string;
 

    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const notionOAuth = new MyOAuthProvider({
      redirectUrl: REDIRECT_URL,
      scope: "mcp:read mcp:write",
      userId,
      supabaseClient: SUPABASE

    });
  
  const authUrl = notionOAuth.generateAuthUrl(state ||'');
    await notionOAuth.handleRedirect(fullUrl);
        return res.redirect(`${front_url}/notion/success?connected=1`);



    res.status(200).type("html").send(`
      <html>
        <body style="font-family:sans-serif; text-align:center; padding-top:40px;">
          <h2>✅ Notion Authorization Successful!</h2>
          <p>You can now return to your app. You may close this tab.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("OAuth redirect error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).send(`<h3>❌ Authorization Failed</h3><pre>${message}</pre>`);
  }
});
// ------------------------
// Imports
// ------------------------




// ------------------------
// Types
// ------------------------
interface NotionPageRow {
  page_id: string;
  page_name: string;
}

interface NotionPagesResponse {
  pages: NotionPageRow[];
}

// ------------------------
// GET /notion/pages
// ------------------------
app.get(
  "/notion/pages",
  async (req: Request, res: Response<NotionPagesResponse | { error: string }>) => {
    try {
      const userId = req.query.userId as string | undefined;

      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }

      // Fetch the user's synced Notion pages
      const { data, error } = await SUPABASE
        .from("notion_pages")
        .select<"page_id, page_name", NotionPageRow>("page_id, page_name")
        .eq("user_id", userId);

      if (error) {
        console.error("❌ Supabase error:", error);
        return res.status(500).json({ error: "Failed to fetch pages" });
      }

      return res.json({
        pages: data ?? [],
      });
    } catch (err: any) {
      console.error("❌ Unexpected server error:", err);
      return res.status(500).json({ error: err.message ?? "Server error" });
    }
  }
);
app.use("/chat", chatRoute);


// ------------------------
// Start Server
// ------------------------


app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
import { Buffer } from "buffer";
import fetch from "node-fetch";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { OAuthTokens, OAuthProviderLike } from "../types/auth-types.js";
import dotenv from "dotenv";
import { Client as NotionClient } from "@notionhq/client";

dotenv.config();

/**
 * MyOAuthProvider
 * --------------------------------------------------
 * Handles Notion OAuth flow and securely stores tokens
 * in the Supabase `notion_connections` table.
 * --------------------------------------------------
 */
export class MyOAuthProvider implements OAuthProviderLike {
  private supabase: SupabaseClient;

  constructor(
    private config: {
      redirectUrl: string;
      scope: string;
      userId: string; // the current authenticated user ID
      supabaseClient?: SupabaseClient;
    }
  ) {
    // use injected Supabase client OR create a new one
    this.supabase =
      config.supabaseClient ??
      createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_API_KEY!);
  }
  async redirectToAuthorization(): Promise<void> {
  // Deprecated in new OAuth flow (we use generateAuthUrl instead)
  // But required because OAuthProviderLike demands this method.
  const placeholderState = "placeholder-state"; // not used
  const url = this.generateAuthUrl(placeholderState);

  console.log("🔗 Visit this URL to authorize Notion access:");
  console.log(url);
}


  /**
   * Generate the Notion OAuth URL (frontend redirects user to this URL).
   * IMPORTANT: Must include `state` to avoid CSRF and to map
   * the callback back to the correct user.
   */
  generateAuthUrl(state: string): string {
    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", process.env.NOTION_CLIENT_ID!);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("redirect_uri", this.config.redirectUrl);
    authUrl.searchParams.set("scope", this.config.scope);
    authUrl.searchParams.set("state", state);

    return authUrl.toString();
  }

  /**
   * Step 2: Handle Notion redirect and exchange the `code` for tokens.
   * The router passes the FULL callback URL (with code + state).
   */
  async handleRedirect(redirectUrl: string): Promise<void> {
    const url = new URL(redirectUrl);

    const code = url.searchParams.get("code");
    if (!code) throw new Error("Missing authorization code in redirect URL");

    console.log("🔁 Exchanging authorization code for tokens...");

    const basicAuth = Buffer.from(
      `${process.env.NOTION_CLIENT_ID!}:${process.env.NOTION_CLIENT_SECRET!}`
    ).toString("base64");

    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUrl,
      }),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Token exchange failed: ${text}`);

    const tokens = JSON.parse(text) as OAuthTokens;

    // Save tokens to Supabase & sync initial pages
    await this.saveTokensToSupabase(tokens);

    console.log("✅ Tokens saved to Supabase");
  }

  /**
   * Step 3: Save tokens to Supabase, and insert the user's pages.
   */
  private async saveTokensToSupabase(tokens: OAuthTokens): Promise<void> {
    const owner = tokens.owner?.user ?? {};

    const { error } = await this.supabase
      .from("notion_connections")
      .upsert(
        {
          user_id: this.config.userId,
          access_token: tokens.access_token,
          token_type: tokens.token_type,
          refresh_token: tokens.refresh_token,
          bot_id: tokens.bot_id,
          workspace_name: tokens.workspace_name,
          workspace_icon: tokens.workspace_icon,
          workspace_id: tokens.workspace_id,

          owner_type: tokens.owner?.type,
          owner_object: owner.object,
          owner_id: owner.id,
          owner_name: owner.name,
          owner_avatar_url: owner.avatar_url,
          owner_user_type: owner.type,
          owner_user_email: owner.person?.email,

          duplicated_template_id: tokens.duplicated_template_id,
          request_id: tokens.request_id,
          raw_response: tokens,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,workspace_id" }
      );

    if (error) {
      console.error("❌ Failed to save tokens:", error);
      throw error;
    }

    // Fetch user's pages
    const notion = new NotionClient({ auth: tokens.access_token });

    const response = await notion.search({
  filter: {
    value: "page",
    property: "object",
  },
  sort: {
    direction: "descending",
    timestamp: "last_edited_time",
  },
});

    const realPages = response.results.filter((p: any) => {
  return (
    p.object === "page" &&
    p.archived === false &&
    p.parent.type === "workspace" // only top-level pages
  );
});

    // Insert pages with correct user_id
    const { error: insertError } = await this.supabase
      .from("notion_pages")
      .insert(
        realPages.map((p: any) => ({
          user_id: this.config.userId,
          page_id: p.id,
          page_name:
            p.properties?.title?.title?.[0]?.plain_text || "Untitled Page",
        }))
      );

    if (insertError) {
      console.error("❌ Failed to insert pages:", insertError);
      throw insertError;
    }

    console.log(`✅ Inserted ${realPages.length} pages into Supabase`);
  }

  /**
   * Step 4: Fetch Access Token for later API calls.
   */
  async getAccessToken(): Promise<string> {
    const { data, error } = await this.supabase
      .from("notion_connections")
      .select("access_token")
      .eq("user_id", this.config.userId)
      .maybeSingle();

    if (error) {
      console.error("❌ Failed to fetch access token:", error);
      throw error;
    }

    if (!data?.access_token)
      throw new Error("No access token found. Please connect Notion first.");

    return data.access_token;
  }
}

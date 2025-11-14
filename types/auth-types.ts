export interface OAuthTokens {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  workspace_id?: string;
  workspace_name?: string;
  [key: string]: any;
}

export interface OAuthProviderLike {
  redirectToAuthorization(): Promise<void>;
  handleRedirect(url: string): Promise<void>;
  getAccessToken(): Promise<string>;
}

import {
  getInstagramOAuthClientId,
  INSTAGRAM_OAUTH_SCOPES,
} from "@/lib/instagramAuth";

const DEFAULT_REDIRECT_URI =
  "https://tasks.thesquirrel.tech/api/instagram/callback";

/**
 * Same string must be sent in the authorize URL and in the token POST `redirect_uri`.
 * Order must stay aligned with any client that used to bake NEXT_PUBLIC_* at build time.
 */
export function resolveInstagramOAuthRedirectUri(): string {
  return (
    process.env.INSTAGRAM_REDIRECT_URI?.trim() ||
    process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI?.trim() ||
    DEFAULT_REDIRECT_URI
  );
}

/** Build the Instagram Login authorize URL on the server (never rely on client env for this). */
export function buildInstagramOAuthAuthorizeUrl(): string {
  const clientId = getInstagramOAuthClientId();
  const redirectUri = resolveInstagramOAuthRedirectUri();
  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_OAUTH_SCOPES,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

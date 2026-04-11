export interface FacebookAppCredentials {
  appId: string;
  appSecret: string;
}

/** Legacy Facebook app id/secret (other features). */
export function getFacebookAppCredentials(): FacebookAppCredentials {
  const appId =
    process.env.FACEBOOK_APP_ID?.trim() ||
    process.env.META_APP_ID?.trim();
  const appSecret =
    process.env.FACEBOOK_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    throw new Error(
      "Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET (or META_APP_ID / META_APP_SECRET)."
    );
  }

  return { appId, appSecret };
}

/** Instagram Login — App ID must match the `client_id` in your Connect URL (see Meta → Instagram use case). */
export function getInstagramAppCredentials(): FacebookAppCredentials {
  const appId =
    process.env.INSTAGRAM_APP_ID?.trim() ||
    process.env.INSTAGRAM_CLIENT_ID?.trim() ||
    "920212874225275";
  const appSecret =
    process.env.INSTAGRAM_APP_SECRET?.trim() ||
    process.env.INSTAGRAM_CLIENT_SECRET?.trim() ||
    process.env.FACEBOOK_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    throw new Error(
      "Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET (Instagram app; Meta App Dashboard → Instagram use case). Optional fallback: META_APP_SECRET for secret only."
    );
  }

  return { appId, appSecret };
}

/**
 * Scopes from Meta "API setup with Instagram login" (comma-separated in authorize URL).
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
 */
export const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
].join(",");

/** graph.instagram.com + api.instagram.com version. */
export const INSTAGRAM_GRAPH_VERSION = "v25.0";

/**
 * Must match the authorize URL `redirect_uri` exactly (Meta compares strings).
 * Do not derive this from request headers — proxies can change scheme/host.
 */
const DEFAULT_INSTAGRAM_OAUTH_REDIRECT_URI =
  "https://tasks.thesquirrel.tech/api/instagram/callback";

export function getInstagramOAuthRedirectUri(): string {
  if (typeof process === "undefined") {
    return DEFAULT_INSTAGRAM_OAUTH_REDIRECT_URI;
  }
  return (
    process.env.INSTAGRAM_REDIRECT_URI?.trim() ||
    process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI?.trim() ||
    DEFAULT_INSTAGRAM_OAUTH_REDIRECT_URI
  );
}

const DEFAULT_INSTAGRAM_APP_ID = "920212874225275";

/** Browser + server: Instagram Login authorize URL (redirect_uri matches token exchange). */
export function getInstagramOAuthAuthorizeUrl(): string {
  const clientId =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID?.trim() ||
        process.env.INSTAGRAM_APP_ID?.trim())) ||
    DEFAULT_INSTAGRAM_APP_ID;
  const redirectUri = getInstagramOAuthRedirectUri();
  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_OAUTH_SCOPES,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

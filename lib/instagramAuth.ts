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

/** Instagram Login (API setup with Instagram login) — App Dashboard shows Instagram App ID. */
export function getInstagramAppCredentials(): FacebookAppCredentials {
  const appId =
    process.env.INSTAGRAM_APP_ID?.trim() ||
    process.env.INSTAGRAM_CLIENT_ID?.trim();
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

export const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";

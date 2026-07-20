import axios from "axios";

export function getLinkedInOAuthConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("Missing LinkedIn OAuth credentials (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET).");
  }

  return {
    clientId,
    clientSecret,
  };
}

export function getLinkedInRedirectUri(request: Request) {
  const explicit = process.env.LINKEDIN_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit;
  }

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}/api/linkedin/callback`;
}

export async function fetchLinkedInAccessToken(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}) {
  const tokenResponse = await axios.post(
    "https://www.linkedin.com/oauth/v2/accessToken",
    null,
    {
      params: {
        grant_type: "authorization_code",
        code: params.code,
        client_id: params.clientId,
        client_secret: params.clientSecret,
        redirect_uri: params.redirectUri,
      },
    }
  );

  return tokenResponse.data as { access_token: string; expires_in: number };
}

export async function fetchLinkedInPersonId(accessToken: string) {
  const profileResponse = await axios.get("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return profileResponse.data as { sub: string };
}

/** Resolves a `urn:li:activity:...` object URN from a post_id field or a LinkedIn post URL. */
export function resolveLinkedInObjectUrn(postId?: string, url?: string) {
  const urnPattern = /urn:li:(?:activity|share|ugcPost):\d+/;

  if (postId) {
    const embedded = postId.match(urnPattern);
    if (embedded) return embedded[0];
    // Scrapers commonly hand back the bare numeric activity id (e.g. "7480521542511214592").
    if (/^\d+$/.test(postId)) return `urn:li:activity:${postId}`;
  }

  if (url) {
    const embedded = url.match(urnPattern);
    if (embedded) return embedded[0];
    // Public post URLs look like .../activity-7480521542511214592-1MX_
    const fromUrl = url.match(/activity-(\d+)/);
    if (fromUrl) return `urn:li:activity:${fromUrl[1]}`;
  }

  return null;
}

/**
 * LinkedIn's comment threads are keyed by the underlying content object's URN
 * (urn:li:ugcPost:... or urn:li:share:...), not the public-facing activity URN.
 * They usually share the same numeric id for simple original posts, but diverge
 * for reshares/some org posts — LinkedIn's error response names the real one.
 */
function extractActualThreadUrn(data: unknown): string | null {
  const message =
    typeof data === "string"
      ? data
      : (data as { message?: string; serviceErrorMessage?: string } | undefined)?.message ||
        (data as { serviceErrorMessage?: string } | undefined)?.serviceErrorMessage ||
        JSON.stringify(data || {});

  const match = message.match(/actual threadUrn:\s*(urn:li:(?:ugcPost|share|activity):\d+)/);
  return match ? match[1]! : null;
}

// LinkedIn Social Actions (Comments) API.
// https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
export async function postLinkedInComment(params: {
  accessToken: string;
  personId: string;
  objectUrn: string;
  text: string;
}) {
  const attempt = async (objectUrn: string) =>
    axios.post(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(objectUrn)}/comments`,
      {
        actor: `urn:li:person:${params.personId}`,
        message: { text: params.text },
      },
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        validateStatus: () => true,
      }
    );

  let res = await attempt(params.objectUrn);

  if (res.status === 400) {
    const actualThreadUrn = extractActualThreadUrn(res.data);
    if (actualThreadUrn && actualThreadUrn !== params.objectUrn) {
      res = await attempt(actualThreadUrn);
    }
  }

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      typeof res.data === "string" ? res.data : JSON.stringify(res.data || { status: res.status })
    );
  }

  const idFromHeader = res.headers["x-restli-id"] || res.headers["X-RestLi-Id"];
  const idFromBody = (res.data as { id?: string } | undefined)?.id;
  return idFromHeader || idFromBody;
}


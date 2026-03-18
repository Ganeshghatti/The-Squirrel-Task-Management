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


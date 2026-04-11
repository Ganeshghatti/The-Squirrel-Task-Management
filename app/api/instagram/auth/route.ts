import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  getInstagramAppCredentials,
  INSTAGRAM_AUTHORIZE_URL,
  INSTAGRAM_OAUTH_SCOPES,
} from "@/lib/instagramAuth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const instagramAccess = (session?.user as { instagramAccess?: boolean } | undefined)?.instagramAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !instagramAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { appId } = getInstagramAppCredentials();
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/instagram/callback`;

  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_OAUTH_SCOPES,
  });

  return Response.redirect(`${INSTAGRAM_AUTHORIZE_URL}?${params.toString()}`);
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getGoogleClientCredentials, YOUTUBE_SCOPES } from "@/lib/youtubeAuth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const youtubeAccess = (session?.user as { youtubeAccess?: boolean } | undefined)?.youtubeAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !youtubeAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { client_id, auth_uri } = getGoogleClientCredentials();
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/youtube/callback`;

  const params = new URLSearchParams({
    client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return Response.redirect(`${auth_uri}?${params.toString()}`);
}

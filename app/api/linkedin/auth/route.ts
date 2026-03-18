import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getLinkedInOAuthConfig, getLinkedInRedirectUri } from "@/lib/linkedin";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; linkedinAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !linkedinAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clientId } = getLinkedInOAuthConfig();
  const redirectUri = getLinkedInRedirectUri(request);

  const state = "taskmaster_linkedin";
  const scope = "openid profile w_member_social";

  const authUrl =
    `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${encodeURIComponent(state)}&` +
    `scope=${encodeURIComponent(scope)}`;

  return Response.redirect(authUrl);
}


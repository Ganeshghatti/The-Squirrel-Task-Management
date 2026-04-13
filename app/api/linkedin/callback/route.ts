import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import LinkedInAccount from "@/models/LinkedInAccount";
import {
  fetchLinkedInAccessToken,
  fetchLinkedInPersonId,
  getLinkedInOAuthConfig,
  getLinkedInRedirectUri,
} from "@/lib/linkedin";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; linkedinAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

  if (!userId) {
    return Response.redirect(new URL("/login", new URL(request.url)));
  }

  if (role !== "admin" && !linkedinAccess) {
    return Response.redirect(`${new URL(request.url).origin}/dashboard`);
  }

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return Response.redirect(`${origin}/linkedin?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return Response.redirect(
      `${origin}/linkedin?error=${encodeURIComponent("Missing authorization code")}`
    );
  }

  try {
    const redirectUri = getLinkedInRedirectUri(request);
    const { clientId, clientSecret } = getLinkedInOAuthConfig();

    const token = await fetchLinkedInAccessToken({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });

    const profile = await fetchLinkedInPersonId(token.access_token);

    await connectDB();
    const existing = await LinkedInAccount.findOne().sort({ updatedAt: -1 });
    const payload = {
      userId,
      personId: profile.sub,
      accessToken: token.access_token,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : undefined,
    };
    if (existing) {
      await LinkedInAccount.updateOne({ _id: existing._id }, { $set: payload });
    } else {
      await LinkedInAccount.create(payload);
    }

    return Response.redirect(`${origin}/linkedin?connected=true`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn OAuth failed";
    return Response.redirect(`${origin}/linkedin?error=${encodeURIComponent(message)}`);
  }
}


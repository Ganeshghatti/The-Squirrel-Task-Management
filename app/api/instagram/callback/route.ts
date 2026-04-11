import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import { getInstagramAppCredentials } from "@/lib/instagramAuth";
import InstagramAccount from "@/models/InstagramAccount";
import {
  exchangeInstagramAuthCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramMe,
} from "@/lib/instagram";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const instagramAccess = (session?.user as { instagramAccess?: boolean } | undefined)?.instagramAccess;

  const { origin } = new URL(request.url);

  if (!userId) {
    return Response.redirect(new URL("/login", new URL(request.url)));
  }

  if (role !== "admin" && !instagramAccess) {
    return Response.redirect(`${origin}/dashboard`);
  }

  const { searchParams } = new URL(request.url);
  // Instagram may show #_ in the browser URL bar; fragments are never sent over HTTP,
  // so `code` here is already the full authorization code (no strip needed).
  const code = searchParams.get("code")?.trim() || null;
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return Response.redirect(`${origin}/instagram?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return Response.redirect(
      `${origin}/instagram?error=${encodeURIComponent("Missing authorization code")}`
    );
  }

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/instagram/callback`;

  try {
    const { appId, appSecret } = getInstagramAppCredentials();
    const { access_token: shortToken, user_id: igUserIdFromToken } =
      await exchangeInstagramAuthCode(appId, appSecret, redirectUri, code);

    const { access_token: longToken } = await exchangeInstagramLongLivedToken(appSecret, shortToken);

    let username = "instagram";
    let profilePictureUrl: string | undefined;
    try {
      const me = await fetchInstagramMe(longToken);
      if (me.username) username = me.username;
      profilePictureUrl = me.profile_picture_url;
    } catch {
      // keep defaults
    }

    const igUserId = igUserIdFromToken;

    await connectDB();

    await InstagramAccount.findOneAndUpdate(
      { userId, igUserId },
      {
        userId,
        igUserId,
        pageId: igUserId,
        username,
        profilePictureUrl,
        pageAccessToken: longToken,
      },
      { upsert: true, new: true }
    );

    return Response.redirect(`${origin}/instagram?connected=true`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth failed";
    return Response.redirect(`${origin}/instagram?error=${encodeURIComponent(message)}`);
  }
}

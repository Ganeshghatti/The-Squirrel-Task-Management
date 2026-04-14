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
import { getPublicOriginFromRequest } from "@/lib/getPublicOriginFromRequest";
import { resolveInstagramOAuthRedirectUri } from "@/lib/instagramOAuthFlow";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const instagramAccess = (session?.user as { instagramAccess?: boolean } | undefined)?.instagramAccess;

  const publicParts = getPublicOriginFromRequest(request);
  const { origin } = publicParts;

  if (!userId) {
    return Response.redirect(new URL("/login", origin));
  }

  if (role !== "admin" && !instagramAccess) {
    return Response.redirect(`${origin}/dashboard`);
  }

  const { searchParams } = new URL(request.url);
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

  const redirectUri = resolveInstagramOAuthRedirectUri();

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
      /* profile optional */
    }

    const igUserId = igUserIdFromToken;

    await connectDB();

    await InstagramAccount.findOneAndUpdate(
      { igUserId },
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

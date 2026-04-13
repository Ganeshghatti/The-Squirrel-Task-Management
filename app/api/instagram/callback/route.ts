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
import {
  buildInstagramOAuthAuthorizeUrl,
  resolveInstagramOAuthRedirectUri,
} from "@/lib/instagramOAuthFlow";
import { getInstagramOAuthClientId } from "@/lib/instagramAuth";

const LOG = "[instagram/callback]";

export async function GET(request: Request) {
  const requestUrl = request.url;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const hostHeader = request.headers.get("host");

  console.log(`${LOG} GET incoming`, {
    requestUrl,
    forwardedHost,
    forwardedProto,
    hostHeader,
  });

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const instagramAccess = (session?.user as { instagramAccess?: boolean } | undefined)?.instagramAccess;

  const publicParts = getPublicOriginFromRequest(request);
  const { origin } = publicParts;

  console.log(`${LOG} session + public origin`, {
    hasUserId: Boolean(userId),
    role,
    instagramAccess: Boolean(instagramAccess),
    publicOrigin: origin,
    publicHost: publicParts.host,
    publicProtocol: publicParts.protocol,
  });

  if (!userId) {
    console.log(`${LOG} redirect → /login (no session)`);
    return Response.redirect(new URL("/login", origin));
  }

  if (role !== "admin" && !instagramAccess) {
    console.log(`${LOG} redirect → /dashboard (forbidden)`);
    return Response.redirect(`${origin}/dashboard`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim() || null;
  const oauthError = searchParams.get("error");

  console.log(`${LOG} query`, {
    hasCode: Boolean(code),
    codeLength: code?.length ?? 0,
    codePrefix: code ? `${code.slice(0, 12)}…` : null,
    oauthError,
  });

  if (oauthError) {
    return Response.redirect(`${origin}/instagram?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return Response.redirect(
      `${origin}/instagram?error=${encodeURIComponent("Missing authorization code")}`
    );
  }

  const redirectUri = resolveInstagramOAuthRedirectUri();
  const clientIdForLog = getInstagramOAuthClientId();
  let serverAuthorizeUrl = "";
  try {
    serverAuthorizeUrl = buildInstagramOAuthAuthorizeUrl();
  } catch {
    serverAuthorizeUrl = "";
  }

  console.log(`${LOG} token exchange inputs`, {
    redirectUri,
    redirectUriJson: JSON.stringify(redirectUri),
    clientIdForLog,
    serverAuthorizeUrlPreview: serverAuthorizeUrl.slice(0, 120),
  });

  try {
    const { appId, appSecret } = getInstagramAppCredentials();
    console.log(`${LOG} credentials`, {
      appId,
      appSecretLength: appSecret.length,
    });

    const { access_token: shortToken, user_id: igUserIdFromToken } =
      await exchangeInstagramAuthCode(appId, appSecret, redirectUri, code);

    console.log(`${LOG} short-lived token OK`, {
      igUserIdFromToken,
      shortTokenLength: shortToken.length,
    });

    const { access_token: longToken } = await exchangeInstagramLongLivedToken(appSecret, shortToken);

    console.log(`${LOG} long-lived token OK`, { longTokenLength: longToken.length });

    let username = "instagram";
    let profilePictureUrl: string | undefined;
    try {
      const me = await fetchInstagramMe(longToken);
      if (me.username) username = me.username;
      profilePictureUrl = me.profile_picture_url;
    } catch (meErr) {
      console.warn(`${LOG} fetchInstagramMe skipped`, meErr);
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

    console.log(`${LOG} DB upsert OK → connected=true`);
    return Response.redirect(`${origin}/instagram?connected=true`);
  } catch (error) {
    console.error(`${LOG} catch`, error);
    const message = error instanceof Error ? error.message : "OAuth failed";
    return Response.redirect(`${origin}/instagram?error=${encodeURIComponent(message)}`);
  }
}

import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import { getGoogleClientCredentials, getYouTubeOAuthRedirectUri } from "@/lib/youtubeAuth";
import YouTubeChannel from "@/models/YouTubeChannel";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const youtubeAccess = (session?.user as { youtubeAccess?: boolean } | undefined)?.youtubeAccess;

  if (!userId) {
    return Response.redirect(new URL("/login", new URL(request.url)));
  }

  if (role !== "admin" && !youtubeAccess) {
    return Response.redirect(`${new URL(request.url).origin}/dashboard`);
  }

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return Response.redirect(`${origin}/youtube?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return Response.redirect(
      `${origin}/youtube?error=${encodeURIComponent("Missing authorization code")}`
    );
  }

  const { client_id, client_secret } = getGoogleClientCredentials();
  const redirectUri = getYouTubeOAuthRedirectUri(request);
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const { data } = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });

    const channel = data.items?.[0];

    if (!channel?.id) {
      return Response.redirect(
        `${origin}/youtube?error=${encodeURIComponent("No YouTube channel found")}`
      );
    }

    if (!tokens.access_token) {
      return Response.redirect(
        `${origin}/youtube?error=${encodeURIComponent("Google did not return an access token")}`
      );
    }

    await connectDB();
    const existingChannel = await YouTubeChannel.findOne({ channelId: channel.id });

    await YouTubeChannel.findOneAndUpdate(
      { channelId: channel.id },
      {
        userId,
        channelId: channel.id,
        title: channel.snippet?.title || "Unknown channel",
        thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || existingChannel?.refreshToken,
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : existingChannel?.tokenExpiry,
      },
      { upsert: true, new: true }
    );

    return Response.redirect(`${origin}/youtube?connected=true`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth failed";

    return Response.redirect(`${origin}/youtube?error=${encodeURIComponent(message)}`);
  }
}

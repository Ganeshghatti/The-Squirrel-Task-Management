import { Readable } from "stream";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import { getGoogleClientCredentials } from "@/lib/youtubeAuth";
import YouTubeUploadHistory from "@/models/YouTubeUploadHistory";
import YouTubeChannel from "@/models/YouTubeChannel";

function getBooleanValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on";
}

function parseChannelIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; youtubeAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const youtubeAccess = (session?.user as { youtubeAccess?: boolean } | undefined)?.youtubeAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !youtubeAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video");
    const title = formData.get("title")?.toString() || "Untitled";
    const description = formData.get("description")?.toString() || "";
    const privacyStatus = formData.get("privacy")?.toString() || "private";
    const channelIds = parseChannelIds(formData.get("channelIds"));
    const tags = (formData.get("tags")?.toString() || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const categoryId = formData.get("categoryId")?.toString() || "28";
    const defaultLanguage = formData.get("defaultLanguage")?.toString()?.trim() || undefined;
    const selfDeclaredMadeForKids = getBooleanValue(formData.get("madeForKids"));
    const embeddable = getBooleanValue(formData.get("embeddable"));
    const publicStatsViewable = getBooleanValue(formData.get("publicStatsViewable"));
    const publishAt = formData.get("publishAt")?.toString()?.trim() || undefined;
    const license = formData.get("license")?.toString() || undefined;
    const containsSyntheticMedia = getBooleanValue(formData.get("containsSyntheticMedia"));
    const recordingDate = formData.get("recordingDate")?.toString()?.trim() || undefined;

    if (!videoFile || typeof videoFile === "string") {
      return Response.json({ error: "Video file is required" }, { status: 400 });
    }

    if (channelIds.length === 0) {
      return Response.json({ error: "Select at least one channel" }, { status: 400 });
    }

    await connectDB();
    const channels = await YouTubeChannel.find({
      channelId: { $in: channelIds },
    });

    if (channels.length !== channelIds.length) {
      return Response.json(
        { error: "One or more channels are missing or disconnected" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await videoFile.arrayBuffer());
    const { client_id, client_secret } = getGoogleClientCredentials();
    const results: Array<{
      channelId: string;
      title: string;
      success: boolean;
      videoId?: string;
      error?: string;
    }> = [];

    for (const channel of channels) {
      const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
      oauth2Client.setCredentials({
        access_token: channel.accessToken,
        refresh_token: channel.refreshToken,
      });

      try {
        if (channel.tokenExpiry && new Date() >= channel.tokenExpiry) {
          const { credentials } = await oauth2Client.refreshAccessToken();

          if (credentials.access_token) {
            channel.accessToken = credentials.access_token;
          }

          channel.tokenExpiry = credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : channel.tokenExpiry;
          await channel.save();
        }

        const youtube = google.youtube({ version: "v3", auth: oauth2Client });
        const parts: Array<"snippet" | "status" | "recordingDetails"> = ["snippet", "status"];

        if (recordingDate) {
          parts.push("recordingDetails");
        }

        const response = await youtube.videos.insert({
          part: parts,
          requestBody: {
            snippet: {
              title,
              description,
              categoryId,
              ...(tags.length > 0 ? { tags } : {}),
              ...(defaultLanguage ? { defaultLanguage } : {}),
            },
            status: {
              privacyStatus,
              selfDeclaredMadeForKids,
              embeddable,
              publicStatsViewable,
              ...(publishAt ? { publishAt: new Date(publishAt).toISOString() } : {}),
              ...(license ? { license } : {}),
              ...(containsSyntheticMedia ? { containsSyntheticMedia } : {}),
            },
            ...(recordingDate
              ? {
                  recordingDetails: {
                    recordingDate: new Date(recordingDate).toISOString(),
                  },
                }
              : {}),
          },
          media: {
            body: Readable.from(buffer),
            mimeType: videoFile.type || "video/mp4",
          },
        });

        const videoId = response.data.id;

        if (!videoId) {
          throw new Error("Upload succeeded but no video id was returned");
        }

        await YouTubeUploadHistory.create({
          userId,
          videoId,
          videoTitle: title,
          channelId: channel.channelId,
          channelTitle: channel.title,
          privacyStatus,
          videoUrl: `https://youtube.com/watch?v=${videoId}`,
          description: description || undefined,
          tags: tags.length > 0 ? tags : undefined,
          categoryId,
          defaultLanguage,
          selfDeclaredMadeForKids,
          embeddable,
          publicStatsViewable,
          publishAt: publishAt ? new Date(publishAt) : undefined,
          license,
          containsSyntheticMedia,
          recordingDate: recordingDate ? new Date(recordingDate) : undefined,
        });

        results.push({
          channelId: channel.channelId,
          title: channel.title,
          success: true,
          videoId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";

        results.push({
          channelId: channel.channelId,
          title: channel.title,
          success: false,
          error: message,
        });
      }
    }

    return Response.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

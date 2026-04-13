import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import InstagramAccount from "@/models/InstagramAccount";
import InstagramUploadHistory from "@/models/InstagramUploadHistory";
import {
  fetchMediaPermalink,
  publishFeedImage,
  publishReelFromVideoBuffer,
} from "@/lib/instagram";

function parseAccountIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
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
  const userId = (session?.user as { id?: string; role?: string; instagramAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const instagramAccess = (session?.user as { instagramAccess?: boolean } | undefined)?.instagramAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !instagramAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const format = formData.get("format")?.toString() === "reels" ? "reels" : "post";
    const caption = formData.get("caption")?.toString() || "";
    const accountIds = parseAccountIds(formData.get("accountIds"));
    const imageUrl = formData.get("imageUrl")?.toString()?.trim() || "";
    const videoFile = formData.get("video");

    if (accountIds.length === 0) {
      return Response.json({ error: "Select at least one Instagram account" }, { status: 400 });
    }

    if (format === "post") {
      if (!imageUrl.startsWith("https://")) {
        return Response.json(
          { error: "Feed posts require a public HTTPS image URL (Instagram Graph API requirement)." },
          { status: 400 }
        );
      }
    } else if (!videoFile || typeof videoFile === "string") {
      return Response.json({ error: "Reels require a video file" }, { status: 400 });
    }

    await connectDB();
    const accounts = await InstagramAccount.find({
      igUserId: { $in: accountIds },
    });

    if (accounts.length !== accountIds.length) {
      return Response.json(
        { error: "One or more Instagram accounts are missing or disconnected" },
        { status: 400 }
      );
    }

    const videoBuffer =
      format === "reels" && videoFile instanceof File
        ? Buffer.from(await videoFile.arrayBuffer())
        : null;

    const results: Array<{
      igUserId: string;
      username: string;
      success: boolean;
      mediaId?: string;
      permalink?: string;
      error?: string;
    }> = [];

    for (const account of accounts) {
      try {
        if (format === "post") {
          const { mediaId } = await publishFeedImage({
            igUserId: account.igUserId,
            pageAccessToken: account.pageAccessToken,
            imageUrl,
            caption,
          });
          const permalink = await fetchMediaPermalink(mediaId, account.pageAccessToken);

          await InstagramUploadHistory.create({
            userId,
            igUserId: account.igUserId,
            username: account.username,
            format: "post",
            mediaId,
            permalink,
            caption: caption || undefined,
            imageUrl,
          });

          results.push({
            igUserId: account.igUserId,
            username: account.username,
            success: true,
            mediaId,
            permalink,
          });
        } else if (videoBuffer) {
          const { mediaId } = await publishReelFromVideoBuffer({
            igUserId: account.igUserId,
            pageAccessToken: account.pageAccessToken,
            video: videoBuffer,
            caption,
          });
          const permalink = await fetchMediaPermalink(mediaId, account.pageAccessToken);

          await InstagramUploadHistory.create({
            userId,
            igUserId: account.igUserId,
            username: account.username,
            format: "reels",
            mediaId,
            permalink,
            caption: caption || undefined,
          });

          results.push({
            igUserId: account.igUserId,
            username: account.username,
            success: true,
            mediaId,
            permalink,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Publish failed";

        await InstagramUploadHistory.create({
          userId,
          igUserId: account.igUserId,
          username: account.username,
          format: format === "reels" ? "reels" : "post",
          caption: caption || undefined,
          imageUrl: format === "post" ? imageUrl : undefined,
          errorMessage: message,
        });

        results.push({
          igUserId: account.igUserId,
          username: account.username,
          success: false,
          error: message,
        });
      }
    }

    return Response.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

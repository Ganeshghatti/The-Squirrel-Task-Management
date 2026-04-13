import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import YouTubeChannel from "@/models/YouTubeChannel";

export async function GET() {
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
    await connectDB();
    const channels = await YouTubeChannel.find(
      {},
      { channelId: 1, title: 1, thumbnailUrl: 1, _id: 0 }
    ).lean();

    return Response.json(channels);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch channels";
    return Response.json({ error: message }, { status: 500 });
  }
}

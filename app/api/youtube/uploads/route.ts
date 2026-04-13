import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import YouTubeUploadHistory from "@/models/YouTubeUploadHistory";

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(parsedLimit, 100);

    await connectDB();
    const uploads = await YouTubeUploadHistory.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return Response.json(uploads);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch uploads";
    return Response.json({ error: message }, { status: 500 });
  }
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import InstagramUploadHistory from "@/models/InstagramUploadHistory";

export async function GET(request: Request) {
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

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

  try {
    await connectDB();
    const rows = await InstagramUploadHistory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return Response.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch history";
    return Response.json({ error: message }, { status: 500 });
  }
}

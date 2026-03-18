import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import LinkedInUploadHistory from "@/models/LinkedInUploadHistory";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; linkedinAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !linkedinAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(parsedLimit, 100);

    await connectDB();
    const posts = await LinkedInUploadHistory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return Response.json(posts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch posts";
    return Response.json({ error: message }, { status: 500 });
  }
}


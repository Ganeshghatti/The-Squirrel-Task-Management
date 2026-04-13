import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import InstagramAccount from "@/models/InstagramAccount";

export async function GET() {
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
    await connectDB();
    const accounts = await InstagramAccount.find(
      {},
      { igUserId: 1, username: 1, profilePictureUrl: 1, pageId: 1, _id: 0 }
    ).lean();

    return Response.json(accounts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch accounts";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

  const igUserId = new URL(request.url).searchParams.get("igUserId");
  if (!igUserId) {
    return Response.json({ error: "igUserId is required" }, { status: 400 });
  }

  try {
    await connectDB();
    const result = await InstagramAccount.deleteOne({ igUserId });
    if (result.deletedCount === 0) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove account";
    return Response.json({ error: message }, { status: 500 });
  }
}

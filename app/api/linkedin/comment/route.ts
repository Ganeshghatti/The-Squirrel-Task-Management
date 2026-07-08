import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import LinkedInAccount from "@/models/LinkedInAccount";
import { postLinkedInComment, resolveLinkedInObjectUrn } from "@/lib/linkedin";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !linkedinAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const postId = typeof body?.post_id === "string" ? body.post_id : undefined;
    const url = typeof body?.url === "string" ? body.url : undefined;

    if (!text) {
      return Response.json({ error: "text is required" }, { status: 400 });
    }

    const objectUrn = resolveLinkedInObjectUrn(postId, url);
    if (!objectUrn) {
      return Response.json(
        { error: "Could not determine the LinkedIn post URN to comment on" },
        { status: 400 }
      );
    }

    await connectDB();
    const account = await LinkedInAccount.findOne().sort({ updatedAt: -1 }).lean();

    if (!account?.accessToken || !account.personId) {
      return Response.json({ error: "LinkedIn is not connected" }, { status: 400 });
    }

    const commentId = await postLinkedInComment({
      accessToken: account.accessToken,
      personId: account.personId,
      objectUrn,
      text,
    });

    return Response.json({ commentId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as any)?.response?.data || "Failed to post comment to LinkedIn";
    return Response.json({ error: message }, { status: 500 });
  }
}

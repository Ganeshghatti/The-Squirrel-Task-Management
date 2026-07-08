import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import LinkedInAccount from "@/models/LinkedInAccount";
import LinkedInCommentHistory from "@/models/LinkedInCommentHistory";
import { postLinkedInComment, resolveLinkedInObjectUrn } from "@/lib/linkedin";

function checkAccess(session: Session | null) {
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

  if (!userId) {
    return { ok: false as const, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (role !== "admin" && !linkedinAccess) {
    return { ok: false as const, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, userId };
}

// GET: List posted-comment history, optionally filtered by ?post_id=
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const access = checkAccess(session);
  if (!access.ok) return access.response;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("post_id");

    const history = await LinkedInCommentHistory.find(postId ? { suggestionPostId: postId } : {})
      .sort({ createdAt: -1 })
      .lean();

    return Response.json(history);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const access = checkAccess(session);
  if (!access.ok) return access.response;
  const userId = access.userId!;
  const userName = (session?.user as { name?: string; email?: string } | undefined)?.name
    || (session?.user as { email?: string } | undefined)?.email;

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

    const historyEntry = await LinkedInCommentHistory.create({
      suggestionPostId: postId || objectUrn,
      objectUrn,
      commentId,
      text,
      userId,
      userName,
    });

    return Response.json({ commentId, history: historyEntry });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as any)?.response?.data || "Failed to post comment to LinkedIn";
    return Response.json({ error: message }, { status: 500 });
  }
}

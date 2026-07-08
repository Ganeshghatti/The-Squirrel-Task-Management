import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import LinkedInSuggestion from "@/models/LinkedInSuggestion";

// GET: List all suggested LinkedIn posts to comment on (linkedinAccess or admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const role = (session?.user as { role?: string } | undefined)?.role;
    const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "admin" && !linkedinAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const suggestions = await LinkedInSuggestion.find().sort({ scraped_at: -1 }).lean();

    return NextResponse.json(suggestions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Ingest a suggested LinkedIn post (upsert by post_id). Public — called by the scraping agent, no auth.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const postId = body?.post_id;

    if (!postId || typeof postId !== "string") {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const scrapedAt = body?.scraped_at ? new Date(body.scraped_at) : new Date();

    await connectDB();

    const suggestion = await LinkedInSuggestion.findOneAndUpdate(
      { post_id: postId },
      { post_id: postId, data: body, scraped_at: scrapedAt },
      { upsert: true, new: true }
    );

    return NextResponse.json(suggestion);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

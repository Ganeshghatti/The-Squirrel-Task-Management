import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import TwitterSuggestion from "@/models/TwitterSuggestion";

// GET: List all suggested tweets to comment on (any logged-in user)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const suggestions = await TwitterSuggestion.find().sort({ scraped_at: -1 }).lean();

    return NextResponse.json(suggestions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Ingest a suggested tweet (upsert by tweet_id). Public — called by the scraping agent, no auth.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tweetId = body?.tweet_id;

    if (!tweetId || typeof tweetId !== "string") {
      return NextResponse.json({ error: "tweet_id is required" }, { status: 400 });
    }

    const scrapedAt = body?.scraped_at ? new Date(body.scraped_at) : new Date();

    await connectDB();

    const suggestion = await TwitterSuggestion.findOneAndUpdate(
      { tweet_id: tweetId },
      { tweet_id: tweetId, data: body, scraped_at: scrapedAt },
      { upsert: true, new: true }
    );

    return NextResponse.json(suggestion);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

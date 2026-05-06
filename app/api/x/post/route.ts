import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getXClient } from "@/lib/x";

function normalizeTweets(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; xAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const xAccess = (session?.user as { xAccess?: boolean } | undefined)?.xAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !xAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const tweets = normalizeTweets(body?.tweets);

    if (tweets.length === 0) {
      return Response.json({ error: "tweets[] is required" }, { status: 400 });
    }

    const client = getXClient();

    console.log("client", client);
    console.log("tweets", tweets, tweets.length);
    // Single post
    if (tweets.length === 1) {
      console.log("tweets[0]", tweets[0]);
      const res = await client.v2.tweet(tweets[0]!);
      console.log("res", res);
      return Response.json({ mode: "tweet", tweetIds: [res.data.id] });
    }

    // Thread posting: chain replies
    const ids: string[] = [];
    const first = await client.v2.tweet(tweets[0]!);
    ids.push(first.data.id);

    for (let i = 1; i < tweets.length; i++) {
      const prevId = ids[ids.length - 1]!;
      const next = await client.v2.tweet({
        text: tweets[i]!,
        reply: { in_reply_to_tweet_id: prevId },
      });
      ids.push(next.data.id);
    }

    return Response.json({ mode: "thread", tweetIds: ids });
  } catch (err: any) {
    console.log("err", err);
    return Response.json({ error: err?.message || "Failed to post to X" }, { status: 500 });
  }
}


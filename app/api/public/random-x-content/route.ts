import { NextResponse } from "next/server";
import knowledge from "@/const/ai_production_knowledge_base.json";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const kb = (knowledge as { knowledge_base: unknown[]; twitter_post_types: Record<string, unknown>[] })
    .knowledge_base;
  const types = (knowledge as { knowledge_base: unknown[]; twitter_post_types: Record<string, unknown>[] })
    .twitter_post_types;

  if (!Array.isArray(kb) || kb.length === 0 || !Array.isArray(types) || types.length === 0) {
    return NextResponse.json(
      { error: "Knowledge base is empty or misconfigured" },
      { status: 500, headers: corsHeaders }
    );
  }

  const knowledge_base = pickRandom(kb);
  const twitter_post_type = pickRandom(types);

  return NextResponse.json(
    { knowledge_base, twitter_post_type },
    { headers: corsHeaders }
  );
}

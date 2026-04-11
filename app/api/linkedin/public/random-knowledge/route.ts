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

/** Public endpoint for LinkedIn content ideation: one random knowledge_base entry. */
export async function GET() {
  const kb = (knowledge as { knowledge_base: unknown[] }).knowledge_base;

  if (!Array.isArray(kb) || kb.length === 0) {
    return NextResponse.json(
      { error: "Knowledge base is empty or misconfigured" },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ knowledge_base: pickRandom(kb) }, { headers: corsHeaders });
}

import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import knowledge from "@/const/ai_production_knowledge_base.json";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function refillBag<T>(source: readonly T[]) {
  return shuffleInPlace(source.slice());
}

// Module-level shuffle-bag: avoids repeats until the bag is exhausted.
// Note: In serverless environments, this persists per warm instance (best-effort).
let knowledgeBag: unknown[] | null = null;

function nextFromBag(source: unknown[]) {
  if (!knowledgeBag?.length) {
    knowledgeBag = refillBag(source);
  }
  return knowledgeBag.pop();
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

  return NextResponse.json({ knowledge_base: nextFromBag(kb) }, { headers: corsHeaders });
}

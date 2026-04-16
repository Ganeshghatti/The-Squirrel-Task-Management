"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import knowledge from "@/const/ai_production_knowledge_base.json";

type KnowledgeItem = {
  id: number;
  topic: string;
  content: string;
  key_points: string[];
};

type TwitterPostType = {
  type_id: number;
  name: string;
  description: string;
  characteristics?: Record<string, string>;
  elements_to_include?: string[];
};

function randomInt(maxExclusive: number) {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
    throw new Error("randomInt(maxExclusive) requires maxExclusive > 0");
  }
  // Prefer cryptographically-strong randomness when available.
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const uint32Max = 2 ** 32;
    const threshold = uint32Max - (uint32Max % maxExclusive);
    const buf = new Uint32Array(1);
    while (true) {
      crypto.getRandomValues(buf);
      const value = buf[0]!;
      if (value < threshold) return value % maxExclusive;
    }
  }
  return Math.floor(Math.random() * maxExclusive);
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function refillBag<T>(source: readonly T[]) {
  const bag = source.slice();
  shuffleInPlace(bag);
  return bag;
}

function formatObjectLines(obj?: Record<string, string>) {
  if (!obj) return "";
  return Object.entries(obj)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

export default function XPromptGenerator() {
  const knowledgeBase = (knowledge as any).knowledge_base as KnowledgeItem[];
  const postTypes = (knowledge as any).twitter_post_types as TwitterPostType[];

  const [idea, setIdea] = useState<KnowledgeItem | null>(null);
  const [postType, setPostType] = useState<TwitterPostType | null>(null);
  const [copied, setCopied] = useState(false);

  const ideaBagRef = useRef<KnowledgeItem[] | null>(null);
  const postTypeBagRef = useRef<TwitterPostType[] | null>(null);

  const randomize = useCallback(() => {
    if (!knowledgeBase?.length || !postTypes?.length) return;

    if (!ideaBagRef.current?.length) {
      ideaBagRef.current = refillBag(knowledgeBase);
    }
    if (!postTypeBagRef.current?.length) {
      postTypeBagRef.current = refillBag(postTypes);
    }

    setIdea(ideaBagRef.current.pop() ?? null);
    setPostType(postTypeBagRef.current.pop() ?? null);
    setCopied(false);
  }, [knowledgeBase, postTypes]);

  useEffect(() => {
    randomize();
  }, [randomize]);

  const prompt = useMemo(() => {
    if (!idea || !postType) return "";

    const elements = postType.elements_to_include?.length
      ? postType.elements_to_include.map((el) => `- ${el}`).join("\n")
      : "";

    return [
      "Write ONE high-performing X (Twitter) post.",
      "",
      "## Content idea (use this as source material)",
      `Topic: ${idea.topic}`,
      "",
      "Source content:",
      idea.content,
      "",
      "Key points:",
      idea.key_points.map((p) => `- ${p}`).join("\n"),
      "",
      "## Post type template to follow",
      `Type: ${postType.name}`,
      `Description: ${postType.description}`,
      "",
      postType.characteristics
        ? ["", "Characteristics:", formatObjectLines(postType.characteristics)].join("\n")
        : "",
      elements ? ["", "Elements to include:", elements].join("\n") : "",
      "",
      "## Constraints",
      "- Output ONLY the final post text (no explanations).",
      "- Keep it skimmable with short lines.",
      "- Use at most 1 emoji total.",
      "- If you include numbers, make them believable and specific.",
    ]
      .filter(Boolean)
      .join("\n");
  }, [idea, postType]);

  const copyToClipboard = useCallback(async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [prompt]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">X</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
            Randomize a content idea + post type, then copy a prompt for any AI chat.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={randomize}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Randomize
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={!prompt}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">Picked content idea</h2>
          {idea ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Topic</p>
                <p className="mt-2 text-sm font-semibold text-white">{idea.topic}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Key points</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-200">
                  {idea.key_points.map((p) => (
                    <li key={p} className="text-gray-300">
                      - {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No idea picked.</p>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">Picked post type</h2>
          {postType ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Type</p>
                <p className="mt-2 text-sm font-semibold text-white">{postType.name}</p>
                <p className="mt-2 text-sm text-gray-400">{postType.description}</p>
              </div>
              {(postType.characteristics || postType.elements_to_include?.length) && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Style hints</p>
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-300">
                    {[
                      postType.characteristics
                        ? `Characteristics:\n${formatObjectLines(postType.characteristics)}`
                        : "",
                      postType.elements_to_include?.length
                        ? `\nElements to include:\n${postType.elements_to_include.map((el) => `- ${el}`).join("\n")}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No post type picked.</p>
          )}
        </div>
      </div>

      <section className="glass-panel rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Prompt</h2>
            <p className="text-sm text-gray-400">
              Paste this into ChatGPT/Claude/Gemini to generate the final X post.
            </p>
          </div>
        </div>

        <pre className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-gray-200 whitespace-pre-wrap">
{prompt || "No prompt yet."}
        </pre>
      </section>
    </div>
  );
}


"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
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

  const randomize = useCallback(() => {
    setIdea(pickRandom(knowledgeBase));
    setPostType(pickRandom(postTypes));
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


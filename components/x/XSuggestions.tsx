"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Copy, Check, Heart, Repeat2, MessageCircle } from "lucide-react";

type Suggestion = {
  _id: string;
  tweet_id: string;
  data: {
    tweet_id?: string;
    author_handle?: string;
    author_name?: string;
    text?: string;
    url?: string;
    category?: string;
    engagement?: { likes?: number; replies?: number; retweets?: number };
    posted_at?: string;
    why_flagged?: string;
    suggested_comment?: string;
    [key: string]: unknown;
  };
  scraped_at: string;
  createdAt: string;
};

const categoryStyles: Record<string, string> = {
  niche: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  pain_point: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  competitor: "border-blue-500/30 bg-blue-500/10 text-blue-400",
};

const dateFilters = [
  { id: "all", label: "All time", days: null },
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
] as const;

function formatCount(n?: number) {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

export default function XSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<(typeof dateFilters)[number]["id"]>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/x/suggestions");
      if (!res.ok) throw new Error("Failed to load suggestions");
      const json = await res.json();
      setSuggestions(Array.isArray(json) ? json : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    suggestions.forEach((s) => {
      if (s.data?.category) set.add(s.data.category);
    });
    return Array.from(set);
  }, [suggestions]);

  const filtered = useMemo(() => {
    const days = dateFilters.find((f) => f.id === dateFilter)?.days ?? null;
    const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;

    return suggestions.filter((s) => {
      if (categoryFilter !== "all" && s.data?.category !== categoryFilter) return false;
      if (cutoff && new Date(s.scraped_at).getTime() < cutoff) return false;
      return true;
    });
  }, [suggestions, categoryFilter, dateFilter]);

  const copyComment = useCallback(async (id: string, text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Comment Suggestions
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
            Tweets worth engaging with, surfaced from sourcing/screening/interview conversations happening on X.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {dateFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDateFilter(f.id)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                dateFilter === f.id
                  ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                  : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition ${
                  categoryFilter === "all"
                    ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                    : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                All categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition ${
                    categoryFilter === cat
                      ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                      : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {cat.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="glass-panel rounded-2xl border border-red-500/20 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-panel rounded-3xl p-10 text-center text-sm text-gray-500">
          Loading suggestions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 text-center text-sm text-gray-500">
          No suggestions yet. Check back soon.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filtered.map((s) => {
            const d = s.data || {};
            const engagement = d.engagement || {};
            const catClass =
              (d.category && categoryStyles[d.category]) ||
              "border-white/10 bg-white/5 text-gray-300";

            return (
              <div key={s._id} className="glass-panel flex flex-col rounded-3xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {d.author_name || d.author_handle || "Unknown author"}
                    </p>
                    {d.author_handle && (
                      <p className="truncate text-xs text-gray-500">@{d.author_handle.replace(/^@/, "")}</p>
                    )}
                  </div>
                  {d.category && (
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${catClass}`}>
                      {String(d.category).replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm text-gray-200">{d.text || "—"}</p>

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Heart size={14} /> {formatCount(engagement.likes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={14} /> {formatCount(engagement.replies)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Repeat2 size={14} /> {formatCount(engagement.retweets)}
                  </span>
                  <span className="ml-auto">
                    Scraped {new Date(s.scraped_at).toLocaleDateString()}
                  </span>
                </div>

                {d.why_flagged && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Why this matters</p>
                    <p className="mt-2 text-sm text-gray-300">{d.why_flagged}</p>
                  </div>
                )}

                {d.suggested_comment && (
                  <div className="mt-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-orange-400/80">Suggested comment</p>
                    <p className="mt-2 text-sm text-gray-200">{d.suggested_comment}</p>
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      <ExternalLink size={16} />
                      Open on X
                    </a>
                  )}
                  {d.suggested_comment && (
                    <button
                      type="button"
                      onClick={() => copyComment(s._id, d.suggested_comment as string)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      {copiedId === s._id ? <Check size={16} /> : <Copy size={16} />}
                      {copiedId === s._id ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

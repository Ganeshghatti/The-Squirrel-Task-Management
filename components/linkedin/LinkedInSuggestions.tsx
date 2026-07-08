"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Copy, Check, ThumbsUp, MessageCircle, Repeat2, Send } from "lucide-react";

type Suggestion = {
  _id: string;
  post_id: string;
  data: {
    post_id?: string;
    post_url?: string;
    author_name?: string;
    author_headline?: string;
    text_snippet?: string;
    engagement?: { likes?: number; comments?: number; reposts?: number };
    posted_at?: string;
    track?: string;
    theme?: string;
    why_flagged?: string;
    suggested_comment?: string;
    [key: string]: unknown;
  };
  scraped_at: string;
  createdAt: string;
};

type CommentHistoryEntry = {
  _id: string;
  suggestionPostId: string;
  commentId?: string;
  text: string;
  userName?: string;
  createdAt: string;
};

const categoryStyles: Record<string, string> = {
  ai_technical: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  pain_point: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  competitor: "border-sky-500/30 bg-sky-500/10 text-sky-400",
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

export default function LinkedInSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<(typeof dateFilters)[number]["id"]>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [commentHistory, setCommentHistory] = useState<CommentHistoryEntry[]>([]);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/suggestions");
      if (!res.ok) throw new Error("Failed to load suggestions");
      const json = await res.json();
      setSuggestions(Array.isArray(json) ? json : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCommentHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/comment");
      if (!res.ok) return;
      const json = await res.json();
      setCommentHistory(Array.isArray(json) ? json : []);
    } catch {
      // Non-fatal — history is a supplementary display.
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
    fetchCommentHistory();
  }, [fetchSuggestions, fetchCommentHistory]);

  const historyByPost = useMemo(() => {
    const map = new Map<string, CommentHistoryEntry[]>();
    commentHistory.forEach((entry) => {
      const list = map.get(entry.suggestionPostId) || [];
      list.push(entry);
      map.set(entry.suggestionPostId, list);
    });
    return map;
  }, [commentHistory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    suggestions.forEach((s) => {
      if (s.data?.theme) set.add(s.data.theme);
    });
    return Array.from(set);
  }, [suggestions]);

  const filtered = useMemo(() => {
    const days = dateFilters.find((f) => f.id === dateFilter)?.days ?? null;
    const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;

    return suggestions.filter((s) => {
      if (categoryFilter !== "all" && s.data?.theme !== categoryFilter) return false;
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

  const draftFor = useCallback(
    (s: Suggestion) => commentDrafts[s._id] ?? s.data?.suggested_comment ?? "",
    [commentDrafts]
  );

  const postComment = useCallback(
    async (s: Suggestion) => {
      const text = draftFor(s).trim();
      if (!text) return;

      setPostingId(s._id);
      setPostResult((prev) => ({ ...prev, [s._id]: undefined as any }));

      try {
        const res = await fetch("/api/linkedin/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: s.post_id, url: s.data?.post_url, text }),
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Failed to post comment");
        }

        if (json?.history) {
          setCommentHistory((prev) => [json.history as CommentHistoryEntry, ...prev]);
        }
        setCommentDrafts((prev) => ({ ...prev, [s._id]: "" }));
        setPostResult((prev) => ({ ...prev, [s._id]: { ok: true, message: "Comment posted." } }));
      } catch (err: any) {
        setPostResult((prev) => ({
          ...prev,
          [s._id]: { ok: false, message: err?.message || "Failed to post comment" },
        }));
      } finally {
        setPostingId(null);
      }
    },
    [draftFor]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Comment Suggestions
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
            LinkedIn posts worth engaging with, surfaced from sourcing/screening/interview conversations happening on LinkedIn.
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
                  ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
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
                    ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
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
                      ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
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
              (d.theme && categoryStyles[d.theme]) || "border-white/10 bg-white/5 text-gray-300";

            return (
              <div key={s._id} className="glass-panel flex flex-col rounded-3xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {d.author_name || "Unknown author"}
                    </p>
                    {d.author_headline && (
                      <p className="truncate text-xs text-gray-500">{d.author_headline}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {d.theme && (
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${catClass}`}>
                        {String(d.theme).replace(/_/g, " ")}
                      </span>
                    )}
                    {d.track && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold capitalize text-gray-400">
                        {String(d.track).replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm text-gray-200">{d.text_snippet || "—"}</p>

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={14} /> {formatCount(engagement.likes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={14} /> {formatCount(engagement.comments)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Repeat2 size={14} /> {formatCount(engagement.reposts)}
                  </span>
                  <span className="ml-auto">
                    Scraped {new Date(s.scraped_at).toLocaleDateString()}
                  </span>
                </div>

                {d.posted_at && (
                  <p className="mt-1 text-xs text-gray-600">
                    Posted {new Date(d.posted_at).toLocaleString()}
                  </p>
                )}

                {d.why_flagged && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Why this matters</p>
                    <p className="mt-2 text-sm text-gray-300">{d.why_flagged}</p>
                  </div>
                )}

                {(historyByPost.get(s.post_id) || []).length > 0 && (
                  <div className="mt-4 space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/80">
                      Posted from this dashboard
                    </p>
                    {(historyByPost.get(s.post_id) || []).map((entry) => (
                      <div key={entry._id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-sm text-gray-200">{entry.text}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {entry.userName || "Someone"} · {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-blue-400/80">Comment</p>
                  <textarea
                    value={draftFor(s)}
                    onChange={(e) =>
                      setCommentDrafts((prev) => ({ ...prev, [s._id]: e.target.value }))
                    }
                    rows={3}
                    placeholder="Write a comment to post on this LinkedIn post..."
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-gray-200 outline-none focus:border-blue-500/40"
                  />
                  {postResult[s._id] && (
                    <p className={`mt-2 text-xs ${postResult[s._id]!.ok ? "text-emerald-400" : "text-red-400"}`}>
                      {postResult[s._id]!.message}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => postComment(s)}
                    disabled={postingId === s._id || !draftFor(s).trim()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={16} />
                    {postingId === s._id ? "Posting..." : "Post comment"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyComment(s._id, draftFor(s))}
                    disabled={!draftFor(s).trim()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copiedId === s._id ? <Check size={16} /> : <Copy size={16} />}
                    {copiedId === s._id ? "Copied" : "Copy"}
                  </button>
                  {d.post_url && (
                    <a
                      href={d.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      <ExternalLink size={16} />
                      Open on LinkedIn
                    </a>
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

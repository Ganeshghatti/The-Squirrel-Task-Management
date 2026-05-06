"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Send, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

function normalizeTweets(input: string[]) {
  return input.map((t) => t.trim()).filter(Boolean);
}

export default function XPoster() {
  const [tweets, setTweets] = useState<string[]>([""]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const normalized = useMemo(() => normalizeTweets(tweets), [tweets]);
  const isThread = normalized.length > 1;

  const submit = async () => {
    setError("");
    setSuccess(null);
    setSubmitting(true);
    try {
      if (normalized.length === 0) throw new Error("Add at least 1 post");

      const res = await fetch("/api/x/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweets: normalized }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to post to X");

      setSuccess(
        `${data.mode === "thread" ? "Thread" : "Tweet"} posted: ${data.tweetIds?.join(", ")}`
      );
      setTweets([""]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="glass-panel rounded-3xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Post to X</h2>
          <p className="mt-1 text-sm text-gray-400">
            Click + to add another post. If you add more than 1, it will post as a thread.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTweets((p) => [...p, ""])}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 flex items-center gap-2"
        >
          <Plus size={16} />
          Add post
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5" />
          <span className="break-words">{success}</span>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <div className="space-y-4">
          {tweets.map((value, idx) => {
            const canRemove = tweets.length > 1;
            return (
              <div key={idx} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                    {isThread ? `Thread post ${idx + 1}` : "Tweet"}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{value.trim().length} chars</span>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => setTweets((p) => p.filter((_, i) => i !== idx))}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove this post"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={value}
                  onChange={(e) =>
                    setTweets((p) => p.map((t, i) => (i === idx ? e.target.value : t)))
                  }
                  className="mt-3 w-full px-4 py-3 min-h-[120px] bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-orange-500/50"
                  placeholder={idx === 0 ? "Write your post..." : "Write next post..."}
                />
              </div>
            );
          })}

          <div className="text-xs text-gray-500">
            Posting mode:{" "}
            <span className="text-gray-300 font-medium">
              {normalized.length > 1 ? "Thread" : "Single tweet"}
            </span>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={submitting}
          onClick={submit}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={18} />
          {submitting ? "Posting..." : normalized.length > 1 ? "Post Thread" : "Post Tweet"}
        </motion.button>
      </div>
    </section>
  );
}


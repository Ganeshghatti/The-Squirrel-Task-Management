"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface LinkedInStatus {
  connected: boolean;
  expiresAt: string | null;
  personId: string | null;
}

interface LinkedInHistoryItem {
  _id?: string;
  postId: string;
  postType: "text" | "image" | "video" | "document";
  text: string;
  createdAt?: string;
}

interface FlashMessage {
  type: "success" | "error";
  text: string;
}

export default function LinkedInManager() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [history, setHistory] = useState<LinkedInHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<FlashMessage | null>(null);

  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const connectUrl = useMemo(() => "/api/linkedin/auth", []);

  const fetchStatus = useCallback(async () => {
    const response = await fetch("/api/linkedin/status");
    const data = (await response.json()) as LinkedInStatus | { error?: string };
    if (!response.ok) {
      throw new Error("error" in data ? data.error : "Failed to load LinkedIn status");
    }
    setStatus(data as LinkedInStatus);
  }, []);

  const fetchHistory = useCallback(async () => {
    const response = await fetch("/api/linkedin/posts?limit=20");
    const data = (await response.json()) as LinkedInHistoryItem[] | { error?: string };
    if (!response.ok) {
      throw new Error("error" in data ? data.error : "Failed to load LinkedIn history");
    }
    setHistory(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) setMessage({ type: "success", text: "LinkedIn connected successfully." });
    if (error) setMessage({ type: "error", text: decodeURIComponent(error) });
    if (connected || error) window.history.replaceState({}, "", "/linkedin");

    (async () => {
      try {
        await fetchStatus();
        await fetchHistory();
      } catch (err) {
        const text = err instanceof Error ? err.message : "Failed to load LinkedIn";
        setMessage({ type: "error", text });
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchHistory, fetchStatus]);

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!text.trim()) {
        setMessage({ type: "error", text: "Post text is required." });
        return;
      }

      setPosting(true);
      setMessage(null);

      try {
        const payload = new FormData();
        payload.append("text", text);
        for (const file of files) {
          payload.append("files", file);
        }

        const response = await fetch("/api/linkedin/post", {
          method: "POST",
          body: payload,
        });
        const data = (await response.json()) as { postId?: string; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Failed to publish");
        }

        setMessage({ type: "success", text: "Published to LinkedIn." });
        setText("");
        setFiles([]);
        await fetchHistory();
      } catch (err) {
        const text = err instanceof Error ? err.message : "Failed to publish";
        setMessage({ type: "error", text });
      } finally {
        setPosting(false);
      }
    },
    [fetchHistory, files, text]
  );

  const helper = useMemo(() => {
    if (files.length === 0) return "Text-only post.";
    if (files.length === 1) {
      const type = files[0]?.type || "";
      if (type.startsWith("video/")) return "1 file → video post.";
      if (type === "application/pdf") return "1 file → document post (PDF via LinkedIn Documents API).";
      return "1 file → image post.";
    }
    return "Multiple files are not supported (attach a single PDF, image, or video).";
  }, [files]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">LinkedIn</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
            Connect your LinkedIn account and publish posts from TaskMaster.
          </p>
        </div>
        <a
          href={connectUrl}
          className="inline-flex items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 px-4 py-3 text-sm font-medium text-sky-200 transition hover:border-sky-400/40 hover:bg-sky-500/20"
        >
          Connect LinkedIn
        </a>
      </div>

      {message && (
        <div
          role="alert"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">Connection</h2>
          <p className="mt-1 text-sm text-gray-400">OAuth status for the current user.</p>

          {loading ? (
            <div className="mt-4 text-sm text-gray-500">Loading...</div>
          ) : status?.connected ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
              <p className="text-sm font-medium text-emerald-200">Connected</p>
              <p className="mt-1 text-xs text-emerald-200/70 truncate">
                Person ID: {status.personId}
              </p>
              {status.expiresAt && (
                <p className="mt-1 text-xs text-emerald-200/70">
                  Expires: {new Date(status.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-400">
              Not connected yet.
            </div>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">Create post</h2>
          <p className="mt-1 text-sm text-gray-400">
            Attach 0 files for text-only, 1 file for image/video/PDF.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                Text
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                placeholder="Write your post..."
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                Attach files
              </label>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,video/mp4,video/quicktime,video/webm,application/pdf"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
              />
              <p className="mt-2 text-xs text-gray-500">{helper}</p>
            </div>

            <button
              type="submit"
              disabled={posting || !status?.connected}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? "Publishing..." : "Publish to LinkedIn"}
            </button>
          </form>
        </div>
      </div>

      <section className="glass-panel rounded-3xl p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Recent posts</h2>
          <p className="text-sm text-gray-400">Latest LinkedIn publishes for your account.</p>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
            No posts yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((post) => (
              <div
                key={post._id || post.postId}
                className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{post.text}</p>
                  <p className="text-xs text-gray-500">
                    {post.postType.toUpperCase()} · {post.postId}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


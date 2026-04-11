"use client";

import { useCallback, useEffect, useState } from "react";
import { INSTAGRAM_OAUTH_SCOPES } from "@/lib/instagramAuth";

interface IgAccount {
  igUserId: string;
  username: string;
  profilePictureUrl?: string;
  pageId: string;
}

interface PublishResult {
  igUserId: string;
  username: string;
  success: boolean;
  mediaId?: string;
  permalink?: string;
  error?: string;
}

interface HistoryRow {
  _id?: string;
  igUserId: string;
  username: string;
  format: "post" | "reels";
  mediaId?: string;
  permalink?: string;
  caption?: string;
  imageUrl?: string;
  errorMessage?: string;
  createdAt?: string;
}

interface FlashMessage {
  type: "success" | "error";
  text: string;
}

/** Must match `resolveInstagramOAuthRedirectUri` in `app/api/instagram/callback/route.ts`. */
const INSTAGRAM_OAUTH_REDIRECT_URI =
  process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI?.trim() ||
  "https://tasks.thesquirrel.tech/api/instagram/callback";
const INSTAGRAM_CLIENT_ID =
  process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID?.trim() || "920212874225275";

const CONNECT_INSTAGRAM_HREF = `https://www.instagram.com/oauth/authorize?${new URLSearchParams({
  force_reauth: "true",
  client_id: INSTAGRAM_CLIENT_ID,
  redirect_uri: INSTAGRAM_OAUTH_REDIRECT_URI,
  response_type: "code",
  scope: INSTAGRAM_OAUTH_SCOPES,
}).toString()}`;

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InstagramManager() {
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const [format, setFormat] = useState<"post" | "reels">("reels");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const selectedCount = selected.size;
  const allSelected = accounts.length > 0 && selectedCount === accounts.length;

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/instagram/accounts");
      const data = (await response.json()) as IgAccount[] | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Failed to load accounts");
      }
      const list = Array.isArray(data) ? data : [];
      setAccounts(list);
      setSelected((previous) => {
        const next = new Set<string>();
        for (const a of list) {
          if (previous.has(a.igUserId)) next.add(a.igUserId);
        }
        return next;
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/instagram/uploads?limit=20");
      const data = (await response.json()) as HistoryRow[] | { error?: string };
      if (response.ok && Array.isArray(data)) {
        setHistory(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
    void fetchHistory();
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) setMessage({ type: "success", text: "Instagram account(s) connected." });
    if (error) setMessage({ type: "error", text: decodeURIComponent(error) });
    if (connected || error) {
      window.history.replaceState({}, "", "/instagram");
    }
  }, [fetchAccounts, fetchHistory]);

  const toggle = useCallback((igUserId: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(igUserId)) next.delete(igUserId);
      else next.add(igUserId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(accounts.map((a) => a.igUserId)));
  }, [allSelected, accounts]);

  const disconnect = useCallback(
    async (igUserId: string) => {
      if (!confirm("Remove this Instagram account from TaskMaster?")) return;
      try {
        const res = await fetch(`/api/instagram/accounts?igUserId=${encodeURIComponent(igUserId)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || "Failed to remove");
        }
        setMessage({ type: "success", text: "Account removed." });
        await fetchAccounts();
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Remove failed" });
      }
    },
    [fetchAccounts]
  );

  const handlePublish = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (selectedCount === 0) {
        setMessage({ type: "error", text: "Select at least one account." });
        return;
      }
      if (format === "post" && !imageUrl.trim().startsWith("https://")) {
        setMessage({
          type: "error",
          text: "Feed posts need a public HTTPS image URL (Meta API requirement).",
        });
        return;
      }
      if (format === "reels" && !video) {
        setMessage({ type: "error", text: "Select a video file for Reels." });
        return;
      }

      setPublishing(true);
      setMessage(null);
      try {
        const payload = new FormData();
        payload.append("format", format);
        payload.append("caption", caption);
        payload.append("accountIds", JSON.stringify(Array.from(selected)));
        if (format === "post") {
          payload.append("imageUrl", imageUrl.trim());
        } else if (video) {
          payload.append("video", video);
        }

        const response = await fetch("/api/instagram/publish", { method: "POST", body: payload });
        const data = (await response.json()) as { results?: PublishResult[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Publish failed");
        }

        const results = data.results || [];
        const ok = results.filter((r) => r.success);
        const bad = results.filter((r) => !r.success);

        if (bad.length === 0) {
          setMessage({
            type: "success",
            text: `Published to ${ok.length} account${ok.length === 1 ? "" : "s"}.`,
          });
          setCaption("");
          setImageUrl("");
          setVideo(null);
          await fetchHistory();
        } else {
          setMessage({
            type: "error",
            text: `${ok.length} succeeded, ${bad.length} failed.`,
          });
          await fetchHistory();
        }
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Publish failed" });
      } finally {
        setPublishing(false);
      }
    },
    [caption, fetchHistory, format, imageUrl, selected, selectedCount, video]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Instagram</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
            Connect Professional Instagram accounts (linked to Facebook Pages), then publish feed posts
            or reels to multiple accounts at once.
          </p>
        </div>
        <a
          href={CONNECT_INSTAGRAM_HREF}
          className="inline-flex items-center justify-center rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/15 px-4 py-3 text-sm font-medium text-fuchsia-100 transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/20"
        >
          Connect Instagram
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

      <section className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Accounts</h2>
              <p className="text-sm text-gray-400">Choose where to publish.</p>
            </div>
            {accounts.length > 0 && (
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium text-orange-400 transition hover:text-orange-300"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-5 text-sm text-gray-400">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-orange-400" />
              Loading accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
              No accounts connected. Use Connect Instagram — you need a Business or Creator Instagram
              linked to a Facebook Page you manage.
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => {
                const isSelected = selected.has(account.igUserId);
                return (
                  <div
                    key={account.igUserId}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                      isSelected
                        ? "border-orange-500/30 bg-orange-500/10"
                        : "border-white/5 bg-white/5 hover:border-white/10"
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(account.igUserId)}
                        className="h-4 w-4 shrink-0 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                      />
                      {account.profilePictureUrl ? (
                        // Avatar host is dynamic (Instagram CDN); skip next/image remote config churn.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.profilePictureUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-gray-300">
                          {account.username.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">@{account.username}</p>
                        <p className="truncate text-xs text-gray-500">{account.igUserId}</p>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => disconnect(account.igUserId)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-300/90 transition hover:bg-red-500/10 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Publish</h2>
            <p className="text-sm text-gray-400">
              <span className="font-medium text-gray-300">Reels:</span> upload a video (same resumable
              flow as Meta&apos;s docs).{" "}
              <span className="font-medium text-gray-300">Feed post:</span> paste a public HTTPS image
              URL — Instagram does not accept raw file upload for single-image posts via this API.
            </p>
          </div>

          <form onSubmit={handlePublish} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                Format
              </label>
              <div className="flex gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white has-[:checked]:border-orange-500/40 has-[:checked]:bg-orange-500/10">
                  <input
                    type="radio"
                    name="format"
                    checked={format === "reels"}
                    onChange={() => setFormat("reels")}
                    className="text-orange-500 focus:ring-orange-500/50"
                  />
                  Reels (video file)
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white has-[:checked]:border-orange-500/40 has-[:checked]:bg-orange-500/10">
                  <input
                    type="radio"
                    name="format"
                    checked={format === "post"}
                    onChange={() => setFormat("post")}
                    className="text-orange-500 focus:ring-orange-500/50"
                  />
                  Feed post (image URL)
                </label>
              </div>
            </div>

            {format === "reels" ? (
              <label
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f?.type.startsWith("video/")) setVideo(f);
                }}
                className={`block cursor-pointer rounded-3xl border-2 border-dashed transition ${
                  dragActive
                    ? "border-orange-400 bg-orange-500/10"
                    : video
                      ? "border-white/10 bg-white/5"
                      : "border-white/10 bg-black/20 hover:border-orange-500/40"
                }`}
              >
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideo(e.target.files?.[0] || null)}
                  className="sr-only"
                />
                <div className="p-8 text-center">
                  {video ? (
                    <div className="space-y-2">
                      <p className="truncate text-sm font-medium text-white">{video.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(video.size)}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setVideo(null);
                        }}
                        className="text-xs font-medium text-red-300 hover:text-red-200"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300">Drop a reel video here or browse</p>
                  )}
                </div>
              </label>
            ) : (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  Image URL (HTTPS, publicly reachable)
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://cdn.example.com/promo.jpg"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                placeholder="Optional caption"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
              />
            </div>

            <button
              type="submit"
              disabled={
                publishing ||
                selectedCount === 0 ||
                (format === "reels" && !video) ||
                (format === "post" && !imageUrl.trim().startsWith("https://"))
              }
              className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing
                ? "Publishing..."
                : `Publish to ${selectedCount} account${selectedCount === 1 ? "" : "s"}`}
            </button>
          </form>
        </div>
      </section>

      <section className="glass-panel rounded-3xl p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Recent activity</h2>
          <p className="text-sm text-gray-400">Latest publish attempts per account.</p>
        </div>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
            History appears after you publish.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((row) => (
              <div
                key={row._id || `${row.igUserId}-${row.createdAt}`}
                className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    @{row.username} · {row.format}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {row.errorMessage || row.caption?.slice(0, 80) || (row.imageUrl ? "Image post" : "—")}
                  </p>
                </div>
                {row.permalink ? (
                  <a
                    href={row.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-orange-400 hover:text-orange-300"
                  >
                    Open on Instagram
                  </a>
                ) : row.errorMessage ? (
                  <span className="text-xs text-red-300/90">Failed</span>
                ) : (
                  <span className="text-xs text-gray-500">—</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

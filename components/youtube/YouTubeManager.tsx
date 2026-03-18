"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

interface YouTubeChannel {
  channelId: string;
  title: string;
  thumbnailUrl?: string;
}

interface UploadHistoryItem {
  _id?: string;
  videoId: string;
  videoTitle: string;
  channelId: string;
  channelTitle: string;
  privacyStatus: string;
  videoUrl?: string;
  createdAt?: string;
}

interface UploadResult {
  channelId: string;
  title: string;
  success: boolean;
  videoId?: string;
  error?: string;
}

interface FlashMessage {
  type: "success" | "error";
  text: string;
}

interface UploadFormState {
  title: string;
  description: string;
  privacy: "private" | "unlisted" | "public";
  video: File | null;
  tags: string;
  categoryId: string;
  defaultLanguage: string;
  madeForKids: boolean;
  embeddable: boolean;
  publicStatsViewable: boolean;
  publishAt: string;
  license: "youtube" | "creativeCommon";
  containsSyntheticMedia: boolean;
  recordingDate: string;
}

const INITIAL_FORM: UploadFormState = {
  title: "",
  description: "",
  privacy: "private",
  video: null,
  tags: "",
  categoryId: "28",
  defaultLanguage: "en",
  madeForKids: false,
  embeddable: true,
  publicStatsViewable: true,
  publishAt: "",
  license: "youtube",
  containsSyntheticMedia: false,
  recordingDate: "",
};

const CATEGORY_OPTIONS = [
  { value: "1", label: "Film & Animation" },
  { value: "2", label: "Autos & Vehicles" },
  { value: "10", label: "Music" },
  { value: "15", label: "Pets & Animals" },
  { value: "17", label: "Sports" },
  { value: "19", label: "Travel & Events" },
  { value: "20", label: "Gaming" },
  { value: "21", label: "Videoblogging" },
  { value: "22", label: "People & Blogs" },
  { value: "23", label: "Comedy" },
  { value: "24", label: "Entertainment" },
  { value: "25", label: "News & Politics" },
  { value: "26", label: "Howto & Style" },
  { value: "27", label: "Education" },
  { value: "28", label: "Science & Technology" },
  { value: "29", label: "Nonprofits & Activism" },
  { value: "42", label: "Shorts" },
];

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function YouTubeManager() {
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [form, setForm] = useState<UploadFormState>(INITIAL_FORM);

  const selectedCount = selectedChannels.size;
  const allSelected = channels.length > 0 && selectedCount === channels.length;

  const updateForm = useCallback(
    <K extends keyof UploadFormState,>(key: K, value: UploadFormState[K]) => {
      setForm((previous) => ({ ...previous, [key]: value }));
    },
    []
  );

  const fetchChannels = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/youtube/channels");
      const data = (await response.json()) as YouTubeChannel[] | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Failed to load channels");
      }

      const nextChannels = Array.isArray(data) ? data : [];
      setChannels(nextChannels);
      setSelectedChannels((previous) => {
        const next = new Set<string>();
        for (const channel of nextChannels) {
          if (previous.has(channel.channelId)) next.add(channel.channelId);
        }
        return next;
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to load channels";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUploadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/youtube/uploads?limit=20");
      const data = (await response.json()) as UploadHistoryItem[] | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Failed to load uploads");
      }

      setUploadHistory(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchChannels();
    void fetchUploadHistory();

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected) setMessage({ type: "success", text: "Channel connected successfully." });
    if (error) setMessage({ type: "error", text: decodeURIComponent(error) });

    if (connected || error) {
      window.history.replaceState({}, "", "/youtube");
    }
  }, [fetchChannels, fetchUploadHistory]);

  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannels((previous) => {
      const next = new Set(previous);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedChannels(allSelected ? new Set<string>() : new Set(channels.map((c) => c.channelId)));
  }, [allSelected, channels]);

  const handleVideoDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files?.[0];
      if (file?.type.startsWith("video/")) updateForm("video", file);
    },
    [updateForm]
  );

  const handleVideoDrag = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  }, []);

  const handleUpload = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!form.video) {
        setMessage({ type: "error", text: "Select a video before uploading." });
        return;
      }

      if (selectedCount === 0) {
        setMessage({ type: "error", text: "Select at least one channel." });
        return;
      }

      setUploading(true);
      setMessage(null);

      try {
        const payload = new FormData();
        payload.append("video", form.video);
        payload.append("title", form.title);
        payload.append("description", form.description);
        payload.append("privacy", form.privacy);
        payload.append("channelIds", JSON.stringify(Array.from(selectedChannels)));
        payload.append("tags", form.tags);
        payload.append("categoryId", form.categoryId);
        payload.append("defaultLanguage", form.defaultLanguage);
        payload.append("madeForKids", String(form.madeForKids));
        payload.append("embeddable", String(form.embeddable));
        payload.append("publicStatsViewable", String(form.publicStatsViewable));
        payload.append("publishAt", form.publishAt);
        payload.append("license", form.license);
        payload.append("containsSyntheticMedia", String(form.containsSyntheticMedia));
        payload.append("recordingDate", form.recordingDate);

        const response = await fetch("/api/youtube/upload", { method: "POST", body: payload });
        const data = (await response.json()) as { results?: UploadResult[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }

        const results = data.results || [];
        const successful = results.filter((result) => result.success);
        const failed = results.filter((result) => !result.success);

        if (failed.length === 0) {
          setMessage({
            type: "success",
            text: `Uploaded to ${successful.length} channel${successful.length === 1 ? "" : "s"}.`,
          });
          setForm(INITIAL_FORM);
          await fetchUploadHistory();
        } else {
          setMessage({
            type: "error",
            text: `${successful.length} uploaded, ${failed.length} failed.`,
          });
        }
      } catch (error) {
        const text = error instanceof Error ? error.message : "Upload failed";
        setMessage({ type: "error", text });
      } finally {
        setUploading(false);
      }
    },
    [fetchUploadHistory, form, selectedChannels, selectedCount]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">YouTube</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
            Connect YouTube channels, upload once, and publish to multiple channels.
          </p>
        </div>
        <a
          href="/api/youtube/auth"
          className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm font-medium text-red-200 transition hover:border-red-400/40 hover:bg-red-500/20"
        >
          Connect YouTube Channel
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
              <h2 className="text-lg font-semibold text-white">Channels</h2>
              <p className="text-sm text-gray-400">Choose where the upload should go.</p>
            </div>
            {channels.length > 0 && (
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
              Loading connected channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
              No channels connected yet. Use the connect button to add one.
            </div>
          ) : (
            <div className="space-y-2">
              {channels.map((channel) => {
                const isSelected = selectedChannels.has(channel.channelId);

                return (
                  <label
                    key={channel.channelId}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      isSelected
                        ? "border-orange-500/30 bg-orange-500/10"
                        : "border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleChannel(channel.channelId)}
                      className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                    />
                    {channel.thumbnailUrl ? (
                      <Image
                        src={channel.thumbnailUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-gray-300">
                        {channel.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{channel.title}</p>
                      <p className="truncate text-xs text-gray-500">{channel.channelId}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Upload Video</h2>
            <p className="text-sm text-gray-400">
              Set video metadata once and publish to every selected channel.
            </p>
          </div>

          <form onSubmit={handleUpload} className="space-y-5">
            <label
              onDragEnter={handleVideoDrag}
              onDragOver={handleVideoDrag}
              onDragLeave={handleVideoDrag}
              onDrop={handleVideoDrop}
              className={`block cursor-pointer rounded-3xl border-2 border-dashed transition ${
                dragActive
                  ? "border-orange-400 bg-orange-500/10"
                  : form.video
                    ? "border-white/10 bg-white/5"
                    : "border-white/10 bg-black/20 hover:border-orange-500/40"
              }`}
            >
              <input
                type="file"
                accept="video/*"
                onChange={(event) => updateForm("video", event.target.files?.[0] || null)}
                className="sr-only"
              />
              <div className="p-8 text-center">
                {form.video ? (
                  <div className="space-y-2">
                    <p className="truncate text-sm font-medium text-white">{form.video.name}</p>
                    <p className="text-xs text-gray-400">{formatSize(form.video.size)}</p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        updateForm("video", null);
                      }}
                      className="text-xs font-medium text-red-300 transition hover:text-red-200"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-white">Drop a video here or browse</p>
                    <p className="text-xs text-gray-500">
                      Large uploads work best from a stable desktop connection.
                    </p>
                  </div>
                )}
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Video title"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  Privacy
                </label>
                <select
                  value={form.privacy}
                  onChange={(event) =>
                    updateForm("privacy", event.target.value as UploadFormState["privacy"])
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                rows={4}
                placeholder="Optional video description"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  Tags
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(event) => updateForm("tags", event.target.value)}
                  placeholder="ai, product, startup"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  Default language
                </label>
                <input
                  type="text"
                  value={form.defaultLanguage}
                  onChange={(event) => updateForm("defaultLanguage", event.target.value)}
                  placeholder="en"
                  maxLength={5}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  Category
                </label>
                <select
                  value={form.categoryId}
                  onChange={(event) => updateForm("categoryId", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  License
                </label>
                <select
                  value={form.license}
                  onChange={(event) =>
                    updateForm("license", event.target.value as UploadFormState["license"])
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                >
                  <option value="youtube">Standard YouTube License</option>
                  <option value="creativeCommon">Creative Commons</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  Publish at
                </label>
                <input
                  type="datetime-local"
                  value={form.publishAt}
                  onChange={(event) => updateForm("publishAt", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  Recording date
                </label>
                <input
                  type="date"
                  value={form.recordingDate}
                  onChange={(event) => updateForm("recordingDate", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500/40"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.madeForKids}
                  onChange={(event) => updateForm("madeForKids", event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                />
                Made for kids
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.embeddable}
                  onChange={(event) => updateForm("embeddable", event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                />
                Allow embedding
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.publicStatsViewable}
                  onChange={(event) => updateForm("publicStatsViewable", event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                />
                Show view counts
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.containsSyntheticMedia}
                  onChange={(event) => updateForm("containsSyntheticMedia", event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                />
                Contains AI media
              </label>
            </div>

            <button
              type="submit"
              disabled={uploading || selectedCount === 0 || !form.video}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading
                ? "Uploading..."
                : `Upload to ${selectedCount} channel${selectedCount === 1 ? "" : "s"}`}
            </button>
          </form>
        </div>
      </section>

      <section className="glass-panel rounded-3xl p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Recent uploads</h2>
          <p className="text-sm text-gray-400">Latest successful uploads across your channels.</p>
        </div>

        {uploadHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-gray-400">
            Upload history will appear here after your first publish.
          </div>
        ) : (
          <div className="space-y-2">
            {uploadHistory.map((upload) => (
              <div
                key={upload._id || `${upload.videoId}-${upload.channelId}-${upload.createdAt}`}
                className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{upload.videoTitle}</p>
                  <p className="truncate text-xs text-gray-500">
                    {upload.channelTitle} · {upload.privacyStatus}
                  </p>
                </div>
                {upload.videoUrl ? (
                  <a
                    href={upload.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-orange-400 transition hover:text-orange-300"
                  >
                    View on YouTube
                  </a>
                ) : (
                  <span className="text-sm text-gray-500">No link available</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type WaStatus = {
  connected?: boolean;
  qr?: string | null;
  connection?: string;
  lastDisconnectStatusCode?: number | null;
  lastDisconnectMessage?: string | null;
};

type WaGroup = { jid: string; subject: string; size: number };

type WaHistoryItem = {
  _id: string;
  createdAt: string;
  status: "success" | "partial" | "failed" | "auth_failed";
  groupJids: string[];
  message: string;
  errorMessage?: string;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export default function WaGroupSender() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [minDelaySec, setMinDelaySec] = useState(4);
  const [maxDelaySec, setMaxDelaySec] = useState(9);
  const [sending, setSending] = useState(false);
  const [logHtml, setLogHtml] = useState<string>("");
  const [history, setHistory] = useState<WaHistoryItem[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connected = Boolean(status?.connected);

  const filteredGroups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return groups;
    return groups.filter((g) => g.subject.toLowerCase().includes(f));
  }, [groups, filter]);

  async function fetchStatus() {
    const r = await fetch("/api/wa/status", { cache: "no-store" });
    const j = await r.json();
    if (r.ok) setStatus(j);
    else setStatus({ connected: false, qr: null, lastDisconnectMessage: j?.error || "Failed" });
  }

  async function fetchSelection() {
    const r = await fetch("/api/wa/selection", { cache: "no-store" });
    const j = await r.json();
    const groupJids = Array.isArray(j?.groupJids) ? j.groupJids : [];
    setSelected(new Set(groupJids));
  }

  async function fetchHistory() {
    const r = await fetch("/api/wa/history", { cache: "no-store" });
    const j = await r.json();
    if (r.ok && Array.isArray(j?.items)) setHistory(j.items);
  }

  async function loginQR() {
    await fetch("/api/wa/login/qr", { method: "POST" });
    await fetchStatus();
  }

  async function resetAuth() {
    if (!confirm("Reset WhatsApp auth and disconnect?")) return;
    await fetch("/api/wa/auth/reset", { method: "POST" });
    setGroups([]);
    setLogHtml("");
    await fetchStatus();
  }

  async function loadGroups() {
    setLoadingGroups(true);
    try {
      await fetchSelection();
      const r = await fetch("/api/wa/groups", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to load groups");
      setGroups(Array.isArray(j?.groups) ? j.groups : []);
    } finally {
      setLoadingGroups(false);
    }
  }

  function saveSelectionSoon(nextSelected: Set<string>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/wa/selection", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ groupJids: Array.from(nextSelected) }),
        });
      } catch {}
    }, 250);
  }

  function toggle(jid: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(jid);
    else next.delete(jid);
    setSelected(next);
    saveSelectionSoon(next);
  }

  function selectAll(on: boolean) {
    const next = new Set(selected);
    for (const g of filteredGroups) {
      if (on) next.add(g.jid);
      else next.delete(g.jid);
    }
    setSelected(next);
    saveSelectionSoon(next);
  }

  async function send() {
    if (!message.trim()) return alert("Write a message first");
    if (selected.size === 0) return alert("Pick at least one group");
    if (!confirm(`Send to ${selected.size} group(s)?`)) return;

    setSending(true);
    setLogHtml("");
    try {
      const minDelayMs = (Number(minDelaySec) || 4) * 1000;
      const maxDelayMs = (Number(maxDelaySec) || 9) * 1000;

      const r = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groupJids: Array.from(selected),
          message,
          minDelayMs,
          maxDelayMs,
        }),
      });
      const j = await r.json();

      if (!r.ok) {
        const err = j?.error || "Failed";
        setLogHtml(`<div style="color:#f87171">✗ ${escapeHtml(String(err))}</div>`);
        return;
      }

      const results = Array.isArray(j?.results) ? j.results : [];
      const html = results
        .map((rr: any) => {
          const g = groups.find((x) => x.jid === rr.jid);
          const name = g?.subject || rr.jid;
          return rr.ok
            ? `<div style="color:#34d399">✓ ${escapeHtml(name)}</div>`
            : `<div style="color:#f87171">✗ ${escapeHtml(name)} — ${escapeHtml(rr.error || "Failed")}</div>`;
        })
        .join("");
      setLogHtml(html || `<div>${escapeHtml(JSON.stringify(j))}</div>`);
      await fetchHistory();
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    const id = setInterval(fetchStatus, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connected && groups.length === 0 && !loadingGroups) {
      loadGroups().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#111] border border-white/5 p-6">
        <h2 className="text-xl font-bold text-white">WhatsApp Group Sender</h2>
        <p className="text-sm text-gray-400 mt-1">
          Connect via QR, select groups, and broadcast a message. Selection is saved in MongoDB.
        </p>

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <button
            onClick={loginQR}
            className="px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
            disabled={sending}
          >
            Use QR Code
          </button>
          <button
            onClick={resetAuth}
            className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/20 text-red-300 hover:bg-red-600/30 transition-colors disabled:opacity-50"
            disabled={sending}
          >
            Reset Auth
          </button>
          <div className="text-sm text-gray-400">
            {connected ? (
              <span className="text-green-400">Connected</span>
            ) : status?.qr ? (
              <span>Scan the QR (WhatsApp → Linked devices)</span>
            ) : (
              <span>Not connected</span>
            )}
          </div>
        </div>

        {!connected && status?.qr ? (
          <div className="mt-4">
            <img
              src={status.qr}
              alt="WhatsApp QR"
              className="bg-white p-2 rounded-xl w-[260px] h-[260px]"
            />
          </div>
        ) : null}

        {!connected && status?.lastDisconnectMessage ? (
          <div className="mt-4 text-sm text-gray-500">
            Last disconnect: <span className="text-gray-300">{status.lastDisconnectMessage}</span>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl bg-[#111] border border-white/5 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <h3 className="text-lg font-semibold text-white">Pick groups</h3>
          <div className="flex flex-wrap gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter groups..."
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-orange-500/40"
            />
            <button
              onClick={() => selectAll(true)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
              disabled={!connected || loadingGroups}
            >
              Select all
            </button>
            <button
              onClick={() => selectAll(false)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
              disabled={loadingGroups}
            >
              Clear
            </button>
            <button
              onClick={loadGroups}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
              disabled={!connected || loadingGroups}
            >
              {loadingGroups ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-4 max-h-[360px] overflow-y-auto rounded-xl border border-white/10">
          {loadingGroups ? (
            <div className="p-4 text-sm text-gray-400">Loading...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No groups found.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredGroups.map((g) => {
                const on = selected.has(g.jid);
                return (
                  <label
                    key={g.jid}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggle(g.jid, e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{g.subject}</div>
                      <div className="text-xs text-gray-500">{g.size} members</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 text-sm text-gray-400">{selected.size} selected</div>
      </div>

      <div className="rounded-2xl bg-[#111] border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white">Message</h3>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="mt-3 w-full min-h-[140px] px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-orange-500/40"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span>Delay between sends (sec):</span>
          <input
            value={minDelaySec}
            onChange={(e) => setMinDelaySec(Number(e.target.value))}
            type="number"
            className="w-20 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
          />
          <span>to</span>
          <input
            value={maxDelaySec}
            onChange={(e) => setMaxDelaySec(Number(e.target.value))}
            type="number"
            className="w-20 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={send}
            disabled={!connected || sending}
            className="px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send to selected"}
          </button>
          <div className="text-xs text-gray-500">
            Sends are spaced randomly. Don’t blast hundreds at once.
          </div>
        </div>

        {logHtml ? (
          <div
            className="mt-4 text-sm"
            dangerouslySetInnerHTML={{ __html: logHtml }}
          />
        ) : null}
      </div>

      <div className="rounded-2xl bg-[#111] border border-white/5 p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">History</h3>
          <button
            onClick={fetchHistory}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {history.length === 0 ? (
            <div className="text-sm text-gray-400">No sends yet.</div>
          ) : (
            history.map((h) => (
              <div key={h._id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="text-sm text-white">
                    <span className="font-semibold">{h.status}</span>{" "}
                    <span className="text-gray-400">•</span>{" "}
                    <span className="text-gray-300">{new Date(h.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-400">{h.groupJids.length} group(s)</div>
                </div>
                {h.errorMessage ? (
                  <div className="mt-1 text-xs text-red-300">{h.errorMessage}</div>
                ) : null}
                <div className="mt-2 text-xs text-gray-400 line-clamp-2 whitespace-pre-wrap">
                  {h.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


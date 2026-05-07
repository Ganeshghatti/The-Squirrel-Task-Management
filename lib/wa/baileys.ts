import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import P from "pino";
import path from "node:path";
import fs from "node:fs/promises";

/**
 * WhatsApp / Baileys singleton for Next.js (single Node process).
 *
 * Critical (per Baileys auth docs): only ONE active socket should write to auth state.
 * Overlapping makeWASocket + saveCreds causes thousands of pre-key-*.json files and failures.
 */

type ConnectionState = {
  connection: string;
  lastDisconnectStatusCode: number | null;
  lastDisconnectMessage: string | null;
};

type WaService = {
  sock: any | null;
  currentQR: string | null;
  ready: boolean;
  state: ConnectionState;
  groupCache: NodeCache;
  started: boolean;
  /** In-flight connect; one at a time */
  connectPromise: Promise<void> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __waService: WaService | undefined;
}

const logger = P({ level: process.env.WA_LOG_LEVEL || "silent" });

/** Stable path in prod (set in PM2 / .env): absolute path recommended */
const authDir = process.env.WA_AUTH_DIR
  ? path.resolve(process.env.WA_AUTH_DIR)
  : path.join(process.cwd(), "auth_info");

function getService(): WaService {
  if (!global.__waService) {
    global.__waService = {
      sock: null,
      currentQR: null,
      ready: false,
      state: { connection: "idle", lastDisconnectStatusCode: null, lastDisconnectMessage: null },
      groupCache: new NodeCache({ stdTTL: 0, useClones: false }),
      started: false,
      connectPromise: null,
      reconnectTimer: null,
    };
  }
  return global.__waService;
}

export function getConnState() {
  return { ...getService().state };
}

export function isStarted() {
  return getService().started;
}

export function getQR() {
  return getService().currentQR;
}

export function isConnected() {
  return getService().ready;
}

/** Fully destroy socket so a new makeWASocket does not overlap (prevents auth file storm). */
async function destroyCurrentSocket(s: WaService) {
  const sock = s.sock;
  s.sock = null;
  s.ready = false;
  if (!sock) return;
  try {
    sock.ev.removeAllListeners();
  } catch {}
  try {
    await sock.end(undefined);
  } catch {}
}

function clearReconnectTimer(s: WaService) {
  if (s.reconnectTimer) {
    clearTimeout(s.reconnectTimer);
    s.reconnectTimer = null;
  }
}

/** Debounced reconnect: reset delay on each close, then a single new socket (no overlap). */
function scheduleReconnect(s: WaService) {
  clearReconnectTimer(s);
  s.reconnectTimer = setTimeout(() => {
    s.reconnectTimer = null;
    connectSockInternal().catch(() => {});
  }, 2000);
}

export async function stopSock() {
  const s = getService();
  clearReconnectTimer(s);
  await destroyCurrentSocket(s);
  s.currentQR = null;
  s.state = { connection: "idle", lastDisconnectStatusCode: null, lastDisconnectMessage: null };
  s.groupCache.flushAll();
  s.connectPromise = null;
  s.started = false;
}

export async function resetAuth() {
  await stopSock();
  try {
    await fs.rm(authDir, { recursive: true, force: true });
  } catch {}
  try {
    await fs.mkdir(authDir, { recursive: true });
  } catch {}
}

/**
 * Single connection pipeline: tear down old socket, one useMultiFileAuthState, one makeWASocket.
 */
async function connectSockInternal() {
  const s = getService();

  if (s.connectPromise) {
    await s.connectPromise;
    return;
  }

  s.connectPromise = (async () => {
    await fs.mkdir(authDir, { recursive: true });

    await destroyCurrentSocket(s);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    let version: [number, number, number] | undefined = undefined;
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest?.version;
    } catch {
      version = undefined;
    }

    const socket = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger,
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      cachedGroupMetadata: async (jid) => s.groupCache.get(jid),
      getMessage: async () => undefined,
    });

    s.sock = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) s.currentQR = qr;
      if (connection) s.state.connection = connection;

      if (connection === "open") {
        s.ready = true;
        s.currentQR = null;
        s.state.lastDisconnectStatusCode = null;
        s.state.lastDisconnectMessage = null;
        clearReconnectTimer(s);
      }

      if (connection === "close") {
        s.ready = false;
        const code = lastDisconnect?.error?.output?.statusCode ?? null;
        s.state.lastDisconnectStatusCode = code;
        s.state.lastDisconnectMessage =
          lastDisconnect?.error?.message ||
          lastDisconnect?.error?.toString?.() ||
          (code ? `statusCode=${code}` : null);

        const shouldReconnect =
          code !== DisconnectReason.loggedOut && code !== DisconnectReason.badSession;

        if (shouldReconnect && s.started) {
          scheduleReconnect(s);
        } else {
          clearReconnectTimer(s);
          s.started = false;
        }
      }
    });

    socket.ev.on("groups.upsert", async (groups: any[]) => {
      for (const g of groups) s.groupCache.set(g.id, g);
    });
    socket.ev.on("groups.update", async (updates: any[]) => {
      for (const u of updates) {
        if (!u?.id) continue;
        try {
          const meta = await socket.groupMetadata(u.id);
          s.groupCache.set(u.id, meta);
        } catch {}
      }
    });
    socket.ev.on("group-participants.update", async ({ id }: any) => {
      if (!id) return;
      try {
        const meta = await socket.groupMetadata(id);
        s.groupCache.set(id, meta);
      } catch {}
    });
  })();

  try {
    await s.connectPromise;
  } finally {
    s.connectPromise = null;
  }
}

export async function startSock() {
  const s = getService();
  s.started = true;
  if (s.ready && s.sock) return;
  clearReconnectTimer(s);
  await connectSockInternal();
}

export async function primeGroupCache() {
  const s = getService();
  if (!s.sock) throw new Error("Socket not started");
  const all = await s.sock.groupFetchAllParticipating();
  for (const jid of Object.keys(all)) s.groupCache.set(jid, all[jid]);
  return all;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendToGroups(
  groupJids: string[],
  message: string,
  { minDelayMs = 4000, maxDelayMs = 9000 }: { minDelayMs?: number; maxDelayMs?: number } = {}
) {
  const s = getService();
  if (!s.sock || !s.ready) throw new Error("Not connected");
  if (!Array.isArray(groupJids) || groupJids.length === 0) return [];

  const min = Number.isFinite(minDelayMs) ? (minDelayMs as number) : 4000;
  const max = Number.isFinite(maxDelayMs) ? (maxDelayMs as number) : 9000;
  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(low, Math.max(min, max));

  const results: any[] = [];
  for (let i = 0; i < groupJids.length; i++) {
    const jid = groupJids[i]!;
    try {
      if (!s.groupCache.get(jid)) {
        const meta = await s.sock.groupMetadata(jid);
        s.groupCache.set(jid, meta);
      }
      const sent = await s.sock.sendMessage(jid, { text: message });
      results.push({ jid, ok: true, id: sent?.key?.id });
    } catch (e: any) {
      results.push({ jid, ok: false, error: e?.message || String(e) });
    }

    if (i < groupJids.length - 1) {
      const wait = Math.floor(low + Math.random() * (high - low));
      await sleep(wait);
    }
  }
  return results;
}

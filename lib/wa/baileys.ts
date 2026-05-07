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
  starting: Promise<void> | null;
  started: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __waService: WaService | undefined;
}

const logger = P({ level: process.env.WA_LOG_LEVEL || "silent" });
// Match your original project exactly: useMultiFileAuthState('auth_info')
const authDir = path.join(process.cwd(), "auth_info");

function getService(): WaService {
  if (!global.__waService) {
    global.__waService = {
      sock: null,
      currentQR: null,
      ready: false,
      state: { connection: "idle", lastDisconnectStatusCode: null, lastDisconnectMessage: null },
      groupCache: new NodeCache({ stdTTL: 0, useClones: false }),
      starting: null,
      started: false,
    };
  }
  return global.__waService;
}

export function getConnState() {
  const s = getService();
  return { ...s.state };
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

export async function stopSock() {
  const s = getService();
  try {
    s.sock?.end?.();
  } catch {}
  s.sock = null;
  s.currentQR = null;
  s.ready = false;
  s.state = { connection: "idle", lastDisconnectStatusCode: null, lastDisconnectMessage: null };
  s.groupCache.flushAll();
  s.starting = null;
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

export async function startSock() {
  const s = getService();
  if (s.ready && s.sock) return;
  if (s.starting) return s.starting;

  s.starting = (async () => {
    s.started = true;
    await fs.mkdir(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    let version: any = undefined;
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest?.version;
    } catch {
      version = undefined;
    }

    s.sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger,
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      cachedGroupMetadata: async (jid) => s.groupCache.get(jid),
      getMessage: async () => undefined,
    });

    s.sock.ev.on("creds.update", saveCreds);

    s.sock.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) s.currentQR = qr;
      if (connection) s.state.connection = connection;

      if (connection === "open") {
        s.ready = true;
        s.currentQR = null;
        s.state.lastDisconnectStatusCode = null;
        s.state.lastDisconnectMessage = null;
      }

      if (connection === "close") {
        s.ready = false;
        const code = lastDisconnect?.error?.output?.statusCode ?? null;
        s.state.lastDisconnectStatusCode = code;
        s.state.lastDisconnectMessage =
          lastDisconnect?.error?.message ||
          lastDisconnect?.error?.toString?.() ||
          (code ? `statusCode=${code}` : null);

        const shouldReconnect = code !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          // Match original behavior: reconnect by starting again (auth_info persists).
          startSock().catch(() => {});
        }
      }
    });

    // Keep cache fresh as groups change.
    s.sock.ev.on("groups.upsert", async (groups: any[]) => {
      for (const g of groups) s.groupCache.set(g.id, g);
    });
    s.sock.ev.on("groups.update", async (updates: any[]) => {
      for (const u of updates) {
        if (!u?.id) continue;
        try {
          const meta = await s.sock.groupMetadata(u.id);
          s.groupCache.set(u.id, meta);
        } catch {}
      }
    });
    s.sock.ev.on("group-participants.update", async ({ id }: any) => {
      if (!id) return;
      try {
        const meta = await s.sock.groupMetadata(id);
        s.groupCache.set(id, meta);
      } catch {}
    });
  })();

  try {
    await s.starting;
  } finally {
    // Always clear; future reconnect attempts must be allowed.
    s.starting = null;
  }
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


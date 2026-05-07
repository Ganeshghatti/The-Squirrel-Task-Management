import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import WaMessageHistory, { WaSendStatus } from "@/models/WaMessageHistory";
import { getConnState, isConnected, isStarted, sendToGroups } from "@/lib/wa/baileys";

export const runtime = "nodejs";

function normalizeGroupJids(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    )
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; waAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const waAccess = (session?.user as { waAccess?: boolean } | undefined)?.waAccess;

  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin" && !waAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const groupJids = normalizeGroupJids(body?.groupJids);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const minDelayMs = Number.isFinite(body?.minDelayMs) ? Number(body.minDelayMs) : undefined;
  const maxDelayMs = Number.isFinite(body?.maxDelayMs) ? Number(body.maxDelayMs) : undefined;

  if (groupJids.length === 0) return Response.json({ error: "No groups" }, { status: 400 });
  if (!message) return Response.json({ error: "No message" }, { status: 400 });

  await connectDB();

  // Create history first so auth/connect failures still get recorded.
  const history = await WaMessageHistory.create({
    userId,
    groupJids,
    message,
    minDelayMs,
    maxDelayMs,
    status: "failed" satisfies WaSendStatus,
  });

  if (!isStarted()) {
    const status: WaSendStatus = "auth_failed";
    const errorMessage = "Not started";
    await WaMessageHistory.updateOne({ _id: history._id }, { $set: { status, errorMessage } });
    return Response.json({ error: errorMessage, historyId: history._id, status, ...getConnState() }, { status: 409 });
  }
  if (!isConnected()) {
    const status: WaSendStatus = "auth_failed";
    const errorMessage = "Not connected";
    await WaMessageHistory.updateOne({ _id: history._id }, { $set: { status, errorMessage } });
    return Response.json({ error: errorMessage, historyId: history._id, status, ...getConnState() }, { status: 409 });
  }

  let results: any[] = [];
  try {
    results = await sendToGroups(groupJids, message, { minDelayMs, maxDelayMs });
  } catch (e: any) {
    const status: WaSendStatus = "failed";
    const errorMessage = e?.message || "Failed to send";
    await WaMessageHistory.updateOne({ _id: history._id }, { $set: { status, errorMessage } });
    return Response.json({ error: errorMessage, historyId: history._id, status }, { status: 500 });
  }

  const okCount = results.filter((r: any) => r?.ok === true).length;
  const failCount = results.length - okCount;

  const status: WaSendStatus =
    failCount === 0 ? "success" : okCount > 0 ? "partial" : "failed";

  await WaMessageHistory.updateOne(
    { _id: history._id },
    { $set: { status, results, errorMessage: undefined } }
  );

  return Response.json({ ok: true, results, historyId: history._id, status });
}


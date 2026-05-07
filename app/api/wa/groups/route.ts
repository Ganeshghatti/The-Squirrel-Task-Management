import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getConnState, isConnected, isStarted, primeGroupCache } from "@/lib/wa/baileys";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; waAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const waAccess = (session?.user as { waAccess?: boolean } | undefined)?.waAccess;

  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin" && !waAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (!isStarted()) {
    return Response.json({ error: "Not started", ...getConnState() }, { status: 409 });
  }
  if (!isConnected()) {
    return Response.json({ error: "Not connected", ...getConnState() }, { status: 409 });
  }

  const all = await primeGroupCache();
  const groups = Object.keys(all)
    .map((jid) => {
      const m: any = (all as any)[jid];
      return {
        jid,
        subject: m?.subject || jid,
        size: m?.participants?.length || 0,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return Response.json({ groups });
}


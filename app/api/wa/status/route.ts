import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import QRCode from "qrcode";
import { getConnState, getQR, isConnected } from "@/lib/wa/baileys";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; waAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const waAccess = (session?.user as { waAccess?: boolean } | undefined)?.waAccess;

  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin" && !waAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  const qr = getQR();
  const qrDataUrl = qr ? await QRCode.toDataURL(qr) : null;
  return Response.json({
    connected: isConnected(),
    qr: qrDataUrl,
    ...getConnState(),
  });
}


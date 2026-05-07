import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import WaMessageHistory from "@/models/WaMessageHistory";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; waAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const waAccess = (session?.user as { waAccess?: boolean } | undefined)?.waAccess;

  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin" && !waAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const items = await WaMessageHistory.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
  return Response.json({ items });
}


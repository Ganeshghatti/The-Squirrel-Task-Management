import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import WaGroupSelection from "@/models/WaGroupSelection";

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

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; waAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const waAccess = (session?.user as { waAccess?: boolean } | undefined)?.waAccess;

  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin" && !waAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const doc = await WaGroupSelection.findOne({ userId }).lean();
  return Response.json({ groupJids: doc?.groupJids ?? [] });
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

  await connectDB();
  const updated = await WaGroupSelection.findOneAndUpdate(
    { userId },
    { $set: { groupJids } },
    { upsert: true, new: true }
  ).lean();

  return Response.json({ ok: true, groupJids: updated?.groupJids ?? groupJids });
}


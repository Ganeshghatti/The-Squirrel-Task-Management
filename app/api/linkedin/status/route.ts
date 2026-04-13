import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import LinkedInAccount from "@/models/LinkedInAccount";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string; linkedinAccess?: boolean } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && !linkedinAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const account = await LinkedInAccount.findOne().sort({ updatedAt: -1 }).lean();

  return Response.json({
    connected: Boolean(account?.accessToken && account?.personId),
    expiresAt: account?.expiresAt || null,
    personId: account?.personId || null,
  });
}


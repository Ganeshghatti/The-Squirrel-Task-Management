import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import CredentialVault, {
  VaultAccessType,
  VaultSeverity,
  VaultStatus,
} from "@/models/CredentialVault";
import { UserRole } from "@/models/User";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const items = await CredentialVault.find({})
      .populate("createdBy", "_id name email role")
      .populate("sharedWithUsers", "_id name email role")
      .sort({ updatedAt: -1 });

    return NextResponse.json(items);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const accessType = body.accessType as VaultAccessType | undefined;

    if (!accessType) {
      return NextResponse.json({ error: "accessType is required" }, { status: 400 });
    }

    await connectDB();

    const created = await CredentialVault.create({
      accessType,
      severity: (body.severity as VaultSeverity | undefined) ?? VaultSeverity.MEDIUM,
      status: (body.status as VaultStatus | undefined) ?? VaultStatus.ACTIVE,

      name: body.name,
      description: body.description,
      websiteLink: body.websiteLink,

      userRole: body.userRole,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,

      createdBy: (session.user as any).id,
      sharedWithUsers: Array.isArray(body.sharedWithUsers) ? body.sharedWithUsers : [],
    });

    const populated = await CredentialVault.findById(created._id)
      .populate("createdBy", "_id name email role")
      .populate("sharedWithUsers", "_id name email role");

    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


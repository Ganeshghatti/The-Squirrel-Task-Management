import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import CredentialVault from "@/models/CredentialVault";
import { UserRole } from "@/models/User";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const updated = await CredentialVault.findByIdAndUpdate(
      params.id,
      {
        ...(body.accessType !== undefined ? { accessType: body.accessType } : {}),
        ...(body.severity !== undefined ? { severity: body.severity } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.websiteLink !== undefined ? { websiteLink: body.websiteLink } : {}),
        ...(body.userRole !== undefined ? { userRole: body.userRole } : {}),
        ...(body.apiKey !== undefined ? { apiKey: body.apiKey } : {}),
        ...(body.apiSecret !== undefined ? { apiSecret: body.apiSecret } : {}),
        ...(body.sharedWithUsers !== undefined
          ? { sharedWithUsers: Array.isArray(body.sharedWithUsers) ? body.sharedWithUsers : [] }
          : {}),
      },
      { new: true, runValidators: true }
    )
      .populate("createdBy", "_id name email role")
      .populate("sharedWithUsers", "_id name email role");

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const deleted = await CredentialVault.findByIdAndDelete(params.id);

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


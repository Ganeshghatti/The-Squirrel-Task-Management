import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectDB from "@/lib/mongodb";
import User, { UserRole } from "@/models/User";
import bcrypt from "bcryptjs";

// PUT: Update user (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, name, role, password, youtubeAccess, linkedinAccess, xAccess } = await request.json();
    const userId = params.id;

    await connectDB();

    const updateData: any = {
      ...(email !== undefined ? { email } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(youtubeAccess !== undefined ? { youtubeAccess: Boolean(youtubeAccess) } : {}),
      ...(linkedinAccess !== undefined ? { linkedinAccess: Boolean(linkedinAccess) } : {}),
      ...(xAccess !== undefined ? { xAccess: Boolean(xAccess) } : {}),
    };
    
    if (password && password.trim() !== "") {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete user (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = params.id;
    
    // Prevent deleting self
    if (userId === session.user.id) {
       return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    await connectDB();

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


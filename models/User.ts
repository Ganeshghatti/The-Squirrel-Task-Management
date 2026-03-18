import mongoose, { Schema, Document, Model } from "mongoose";
import connectDB from "@/lib/mongodb";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

export interface IUser extends Document {
  email: string;
  password: string;
  role: UserRole;
  youtubeAccess: boolean;
  linkedinAccess: boolean;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    youtubeAccess: {
      type: Boolean,
      default: false,
    },
    linkedinAccess: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure the database connection is established before creating the model
let User: Model<IUser>;

try {
  User = mongoose.model<IUser>("User");
} catch {
  User = mongoose.model<IUser>("User", UserSchema);
}

export default User;


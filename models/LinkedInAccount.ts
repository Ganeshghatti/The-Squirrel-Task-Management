import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILinkedInAccount extends Document {
  /** Last user who connected (stored only; not used for access checks). */
  userId?: string;
  personId: string;
  accessToken: string;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const LinkedInAccountSchema = new Schema<ILinkedInAccount>(
  {
    userId: { type: String, index: true },
    personId: { type: String, required: true },
    accessToken: { type: String, required: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

const LinkedInAccount =
  (mongoose.models.LinkedInAccount as Model<ILinkedInAccount> | undefined) ||
  mongoose.model<ILinkedInAccount>("LinkedInAccount", LinkedInAccountSchema);

export default LinkedInAccount;

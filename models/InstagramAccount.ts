import mongoose, { Document, Model, Schema } from "mongoose";

export interface IInstagramAccount extends Document {
  userId: string;
  igUserId: string;
  pageId: string;
  username: string;
  profilePictureUrl?: string;
  pageAccessToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstagramAccountSchema = new Schema<IInstagramAccount>(
  {
    userId: { type: String, required: true, index: true },
    igUserId: { type: String, required: true },
    pageId: { type: String, required: true },
    username: { type: String, required: true },
    profilePictureUrl: { type: String },
    pageAccessToken: { type: String, required: true },
  },
  { timestamps: true }
);

InstagramAccountSchema.index({ userId: 1, igUserId: 1 }, { unique: true });

const InstagramAccount =
  (mongoose.models.InstagramAccount as Model<IInstagramAccount> | undefined) ||
  mongoose.model<IInstagramAccount>("InstagramAccount", InstagramAccountSchema);

export default InstagramAccount;

import mongoose, { Document, Model, Schema } from "mongoose";

export type LinkedInPostType = "text" | "image" | "video" | "document";

export interface ILinkedInUploadHistory extends Document {
  userId: string;
  postId: string;
  postType: LinkedInPostType;
  text: string;
  asset?: string;
  visibility: "PUBLIC";
  createdAt: Date;
  updatedAt: Date;
}

const LinkedInUploadHistorySchema = new Schema<ILinkedInUploadHistory>(
  {
    userId: { type: String, required: true, index: true },
    postId: { type: String, required: true },
    postType: { type: String, required: true, enum: ["text", "image", "video", "document"] },
    text: { type: String, required: true },
    asset: { type: String },
    visibility: { type: String, default: "PUBLIC" },
  },
  { timestamps: true }
);

LinkedInUploadHistorySchema.index({ userId: 1, createdAt: -1 });

const LinkedInUploadHistory =
  (mongoose.models.LinkedInUploadHistory as Model<ILinkedInUploadHistory> | undefined) ||
  mongoose.model<ILinkedInUploadHistory>("LinkedInUploadHistory", LinkedInUploadHistorySchema);

export default LinkedInUploadHistory;


import mongoose, { Document, Model, Schema } from "mongoose";

export type InstagramPublishFormat = "post" | "reels";

export interface IInstagramUploadHistory extends Document {
  userId: string;
  igUserId: string;
  username: string;
  format: InstagramPublishFormat;
  mediaId?: string;
  permalink?: string;
  caption?: string;
  imageUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstagramUploadHistorySchema = new Schema<IInstagramUploadHistory>(
  {
    userId: { type: String, required: true, index: true },
    igUserId: { type: String, required: true },
    username: { type: String, required: true },
    format: { type: String, enum: ["post", "reels"], required: true },
    mediaId: { type: String },
    permalink: { type: String },
    caption: { type: String },
    imageUrl: { type: String },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

InstagramUploadHistorySchema.index({ userId: 1, igUserId: 1, createdAt: -1 });
InstagramUploadHistorySchema.index({ userId: 1, createdAt: -1 });

const InstagramUploadHistory =
  (mongoose.models.InstagramUploadHistory as Model<IInstagramUploadHistory> | undefined) ||
  mongoose.model<IInstagramUploadHistory>(
    "InstagramUploadHistory",
    InstagramUploadHistorySchema
  );

export default InstagramUploadHistory;

import mongoose, { Document, Model, Schema } from "mongoose";

export interface IYouTubeUploadHistory extends Document {
  userId: string;
  videoId: string;
  videoTitle: string;
  channelId: string;
  channelTitle: string;
  privacyStatus: string;
  videoUrl?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  defaultLanguage?: string;
  selfDeclaredMadeForKids?: boolean;
  embeddable?: boolean;
  publicStatsViewable?: boolean;
  publishAt?: Date;
  license?: string;
  containsSyntheticMedia?: boolean;
  recordingDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const YouTubeUploadHistorySchema = new Schema<IYouTubeUploadHistory>(
  {
    userId: { type: String, required: true, index: true },
    videoId: { type: String, required: true },
    videoTitle: { type: String, required: true },
    channelId: { type: String, required: true },
    channelTitle: { type: String, required: true },
    privacyStatus: { type: String, default: "private" },
    videoUrl: { type: String },
    description: { type: String },
    tags: [{ type: String }],
    categoryId: { type: String },
    defaultLanguage: { type: String },
    selfDeclaredMadeForKids: { type: Boolean },
    embeddable: { type: Boolean },
    publicStatsViewable: { type: Boolean },
    publishAt: { type: Date },
    license: { type: String },
    containsSyntheticMedia: { type: Boolean },
    recordingDate: { type: Date },
  },
  { timestamps: true }
);

YouTubeUploadHistorySchema.index({ userId: 1, channelId: 1, createdAt: -1 });
YouTubeUploadHistorySchema.index({ userId: 1, createdAt: -1 });

const YouTubeUploadHistory =
  (mongoose.models.YouTubeUploadHistory as Model<IYouTubeUploadHistory> | undefined) ||
  mongoose.model<IYouTubeUploadHistory>("YouTubeUploadHistory", YouTubeUploadHistorySchema);

export default YouTubeUploadHistory;


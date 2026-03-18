import mongoose, { Document, Model, Schema } from "mongoose";

export interface IYouTubeChannel extends Document {
  userId: string;
  channelId: string;
  title: string;
  thumbnailUrl?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const YouTubeChannelSchema = new Schema<IYouTubeChannel>(
  {
    userId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    title: { type: String, required: true },
    thumbnailUrl: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    tokenExpiry: { type: Date },
  },
  { timestamps: true }
);

YouTubeChannelSchema.index({ userId: 1, channelId: 1 }, { unique: true });

const YouTubeChannel =
  (mongoose.models.YouTubeChannel as Model<IYouTubeChannel> | undefined) ||
  mongoose.model<IYouTubeChannel>("YouTubeChannel", YouTubeChannelSchema);

export default YouTubeChannel;

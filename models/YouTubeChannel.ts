import mongoose, { Document, Model, Schema } from "mongoose";

export interface IYouTubeChannel extends Document {
  /** Last user who connected this channel (stored only; not used for access checks). */
  userId?: string;
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
    userId: { type: String, index: true },
    channelId: { type: String, required: true },
    title: { type: String, required: true },
    thumbnailUrl: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    tokenExpiry: { type: Date },
  },
  { timestamps: true }
);

YouTubeChannelSchema.index({ channelId: 1 }, { unique: true });

const YouTubeChannel =
  (mongoose.models.YouTubeChannel as Model<IYouTubeChannel> | undefined) ||
  mongoose.model<IYouTubeChannel>("YouTubeChannel", YouTubeChannelSchema);

export default YouTubeChannel;

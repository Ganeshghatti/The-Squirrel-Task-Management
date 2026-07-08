import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILinkedInCommentHistory extends Document {
  suggestionPostId: string;
  objectUrn: string;
  commentId?: string;
  text: string;
  userId: string;
  userName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LinkedInCommentHistorySchema = new Schema<ILinkedInCommentHistory>(
  {
    suggestionPostId: { type: String, required: true, index: true },
    objectUrn: { type: String, required: true },
    commentId: { type: String },
    text: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String },
  },
  { timestamps: true }
);

LinkedInCommentHistorySchema.index({ suggestionPostId: 1, createdAt: -1 });

const LinkedInCommentHistory =
  (mongoose.models.LinkedInCommentHistory as Model<ILinkedInCommentHistory> | undefined) ||
  mongoose.model<ILinkedInCommentHistory>("LinkedInCommentHistory", LinkedInCommentHistorySchema);

export default LinkedInCommentHistory;

import mongoose, { Document, Model, Schema } from "mongoose";

export interface ITwitterSuggestion extends Document {
  tweet_id: string;
  data: Record<string, unknown>;
  scraped_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TwitterSuggestionSchema = new Schema<ITwitterSuggestion>(
  {
    tweet_id: { type: String, required: true, unique: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    scraped_at: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true, strict: false }
);

TwitterSuggestionSchema.index({ scraped_at: -1 });

const TwitterSuggestion =
  (mongoose.models.TwitterSuggestion as Model<ITwitterSuggestion> | undefined) ||
  mongoose.model<ITwitterSuggestion>("TwitterSuggestion", TwitterSuggestionSchema);

export default TwitterSuggestion;

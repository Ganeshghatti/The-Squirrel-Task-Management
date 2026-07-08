import mongoose, { Document, Model, Schema } from "mongoose";

export interface ILinkedInSuggestion extends Document {
  post_id: string;
  data: Record<string, unknown>;
  scraped_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LinkedInSuggestionSchema = new Schema<ILinkedInSuggestion>(
  {
    post_id: { type: String, required: true, unique: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    scraped_at: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true, strict: false }
);

LinkedInSuggestionSchema.index({ scraped_at: -1 });

const LinkedInSuggestion =
  (mongoose.models.LinkedInSuggestion as Model<ILinkedInSuggestion> | undefined) ||
  mongoose.model<ILinkedInSuggestion>("LinkedInSuggestion", LinkedInSuggestionSchema);

export default LinkedInSuggestion;

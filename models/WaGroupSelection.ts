import mongoose, { Document, Model, Schema } from "mongoose";

export interface IWaGroupSelection extends Document {
  userId: string;
  groupJids: string[];
  updatedAt: Date;
  createdAt: Date;
}

const WaGroupSelectionSchema = new Schema<IWaGroupSelection>(
  {
    userId: { type: String, required: true, index: true, unique: true },
    groupJids: { type: [String], default: [] },
  },
  { timestamps: true }
);

WaGroupSelectionSchema.index({ userId: 1 });

const WaGroupSelection =
  (mongoose.models.WaGroupSelection as Model<IWaGroupSelection> | undefined) ||
  mongoose.model<IWaGroupSelection>("WaGroupSelection", WaGroupSelectionSchema);

export default WaGroupSelection;


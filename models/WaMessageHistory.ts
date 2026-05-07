import mongoose, { Document, Model, Schema } from "mongoose";

export type WaSendStatus = "success" | "partial" | "failed" | "auth_failed";

export interface IWaSendResult {
  jid: string;
  ok: boolean;
  id?: string;
  error?: string;
}

export interface IWaMessageHistory extends Document {
  userId: string;
  groupJids: string[];
  message: string;
  minDelayMs?: number;
  maxDelayMs?: number;
  status: WaSendStatus;
  results?: IWaSendResult[];
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WaSendResultSchema = new Schema<IWaSendResult>(
  {
    jid: { type: String, required: true },
    ok: { type: Boolean, required: true },
    id: { type: String },
    error: { type: String },
  },
  { _id: false }
);

const WaMessageHistorySchema = new Schema<IWaMessageHistory>(
  {
    userId: { type: String, required: true, index: true },
    groupJids: { type: [String], default: [] },
    message: { type: String, required: true },
    minDelayMs: { type: Number },
    maxDelayMs: { type: Number },
    status: { type: String, required: true, enum: ["success", "partial", "failed", "auth_failed"] },
    results: { type: [WaSendResultSchema] },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

WaMessageHistorySchema.index({ userId: 1, createdAt: -1 });

const WaMessageHistory =
  (mongoose.models.WaMessageHistory as Model<IWaMessageHistory> | undefined) ||
  mongoose.model<IWaMessageHistory>("WaMessageHistory", WaMessageHistorySchema);

export default WaMessageHistory;


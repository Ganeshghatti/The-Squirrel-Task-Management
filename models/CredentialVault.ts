import mongoose, { Schema, Document, Model, Types } from "mongoose";

export enum VaultAccessType {
  API_KEY = "api_key",
  USER_ROLE = "user_role",
}

export enum VaultSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum VaultStatus {
  ACTIVE = "active",
  ROTATED = "rotated",
  REVOKED = "revoked",
  EXPIRED = "expired",
}

export interface ICredentialVault extends Document {
  accessType: VaultAccessType;
  severity: VaultSeverity;
  status: VaultStatus;

  // Common metadata
  name: string;
  description?: string;
  websiteLink?: string;

  // USER_ROLE access
  userRole?: string;

  // API_KEY access
  apiKey?: string;
  apiSecret?: string;

  // Mapping / ownership
  createdBy: Types.ObjectId;
  sharedWithUsers: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

const CredentialVaultSchema: Schema = new Schema(
  {
    accessType: {
      type: String,
      enum: Object.values(VaultAccessType),
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(VaultSeverity),
      default: VaultSeverity.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(VaultStatus),
      default: VaultStatus.ACTIVE,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    websiteLink: {
      type: String,
      trim: true,
    },

    userRole: {
      type: String,
      trim: true,
    },

    apiKey: {
      type: String,
      trim: true,
    },
    apiSecret: {
      type: String,
      trim: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sharedWithUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
  },
  { timestamps: true }
);

CredentialVaultSchema.pre("validate", function (next) {
  const doc = this as unknown as ICredentialVault;

  if (doc.accessType === VaultAccessType.API_KEY) {
    if (!doc.apiKey?.trim() || !doc.apiSecret?.trim()) {
      return next(new Error("API key and secret are required for API_KEY accessType"));
    }
  }

  if (doc.accessType === VaultAccessType.USER_ROLE) {
    if (!doc.userRole?.trim()) {
      return next(new Error("userRole is required for USER_ROLE accessType"));
    }
  }

  next();
});

let CredentialVault: Model<ICredentialVault>;

try {
  CredentialVault = mongoose.model<ICredentialVault>("CredentialVault");
} catch {
  CredentialVault = mongoose.model<ICredentialVault>(
    "CredentialVault",
    CredentialVaultSchema
  );
}

export default CredentialVault;


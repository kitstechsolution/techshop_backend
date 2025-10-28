import mongoose, { Document, Types } from 'mongoose';

export interface IPasswordResetToken extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index - MongoDB will auto-delete expired tokens
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster token lookups
passwordResetTokenSchema.index({ token: 1 });
passwordResetTokenSchema.index({ user: 1 });

export const PasswordResetToken = mongoose.model<IPasswordResetToken>(
  'PasswordResetToken',
  passwordResetTokenSchema
);

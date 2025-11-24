import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUploadedImage extends Document {
    url: string;
    filename: string;
    provider: 'local' | 'cloudinary';
    uploadedBy: Types.ObjectId;
    uploadedAt: Date;

    // Usage tracking
    isUsed: boolean;
    usedIn: {
        model: string;
        documentId: Types.ObjectId;
        field: string;
    }[];

    // Cleanup tracking
    markedForDeletion: boolean;
    deletionScheduledAt: Date | null;

    // Metadata
    size: number;
    mimeType: string;
    cloudinaryId?: string;
}

const uploadedImageSchema = new Schema<IUploadedImage>({
    url: {
        type: String,
        required: true,
        index: true,
    },
    filename: {
        type: String,
        required: true,
    },
    provider: {
        type: String,
        enum: ['local', 'cloudinary'],
        required: true,
    },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },

    // Usage tracking
    isUsed: {
        type: Boolean,
        default: false,
        index: true,
    },
    usedIn: [{
        model: {
            type: String,
            required: true,
        },
        documentId: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        field: {
            type: String,
            required: true,
        },
    }],

    // Cleanup tracking
    markedForDeletion: {
        type: Boolean,
        default: false,
        index: true,
    },
    deletionScheduledAt: {
        type: Date,
        default: null,
        index: true,
    },

    // Metadata
    size: {
        type: Number,
        required: true,
    },
    mimeType: {
        type: String,
        required: true,
    },
    cloudinaryId: {
        type: String,
        sparse: true,
    },
}, {
    timestamps: true,
});

// Index for cleanup queries
uploadedImageSchema.index({ isUsed: 1, markedForDeletion: 1, deletionScheduledAt: 1 });
uploadedImageSchema.index({ provider: 1, markedForDeletion: 1 });

const UploadedImage = mongoose.model<IUploadedImage>('UploadedImage', uploadedImageSchema);

export default UploadedImage;

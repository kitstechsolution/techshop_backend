import { Request, Response } from 'express';
import UploadedImage from '../models/UploadedImage.js';
import { triggerManualCleanup } from '../services/imageCleanupService.js';
import { logger } from '../utils/logger.js';

/**
 * Mark images as used when they're associated with a document
 * POST /api/images/mark-used
 */
export const markImagesAsUsed = async (req: Request, res: Response): Promise<void> => {
    try {
        const { urls, model, documentId, field } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            res.status(400).json({ message: 'URLs array is required' });
            return;
        }

        if (!model || !documentId || !field) {
            res.status(400).json({ message: 'model, documentId, and field are required' });
            return;
        }

        const updated = [];

        for (const url of urls) {
            const image = await UploadedImage.findOne({ url });

            if (image) {
                // Check if this reference already exists
                const existingRef = image.usedIn.find(
                    ref => ref.model === model &&
                        ref.documentId.toString() === documentId &&
                        ref.field === field
                );

                if (!existingRef) {
                    image.usedIn.push({ model, documentId, field });
                }

                image.isUsed = true;
                image.markedForDeletion = false;
                image.deletionScheduledAt = null;
                await image.save();
                updated.push(url);
            }
        }

        res.status(200).json({
            message: `Marked ${updated.length} images as used`,
            updated
        });
    } catch (error: any) {
        logger.error('Error marking images as used:', error);
        res.status(500).json({ message: 'Failed to mark images as used', error: error.message });
    }
};

/**
 * Mark images as unused when they're removed from a document
 * POST /api/images/mark-unused
 */
export const markImagesAsUnused = async (req: Request, res: Response): Promise<void> => {
    try {
        const { urls, model, documentId, field } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            res.status(400).json({ message: 'URLs array is required' });
            return;
        }

        const updated = [];

        for (const url of urls) {
            const image = await UploadedImage.findOne({ url });

            if (image) {
                // Remove the specific reference
                if (model && documentId && field) {
                    image.usedIn = image.usedIn.filter(
                        ref => !(ref.model === model &&
                            ref.documentId.toString() === documentId &&
                            ref.field === field)
                    );
                } else {
                    // If no specific reference provided, clear all
                    image.usedIn = [];
                }

                // If no more references, mark as unused
                if (image.usedIn.length === 0) {
                    image.isUsed = false;
                }

                await image.save();
                updated.push(url);
            }
        }

        res.status(200).json({
            message: `Marked ${updated.length} images as unused`,
            updated
        });
    } catch (error: any) {
        logger.error('Error marking images as unused:', error);
        res.status(500).json({ message: 'Failed to mark images as unused', error: error.message });
    }
};

/**
 * Get cleanup statistics
 * GET /api/images/stats
 */
export const getCleanupStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalImages = await UploadedImage.countDocuments();
        const usedImages = await UploadedImage.countDocuments({ isUsed: true });
        const unusedImages = await UploadedImage.countDocuments({ isUsed: false });
        const markedForDeletion = await UploadedImage.countDocuments({ markedForDeletion: true });
        const scheduledDeletions = await UploadedImage.find({
            markedForDeletion: true,
            deletionScheduledAt: { $ne: null }
        }).select('url deletionScheduledAt').limit(10);

        res.status(200).json({
            total: totalImages,
            used: usedImages,
            unused: unusedImages,
            markedForDeletion,
            upcomingDeletions: scheduledDeletions,
        });
    } catch (error: any) {
        logger.error('Error getting cleanup stats:', error);
        res.status(500).json({ message: 'Failed to get stats', error: error.message });
    }
};

/**
 * Manually delete a specific image
 * DELETE /api/images/:id
 */
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const image = await UploadedImage.findById(id);

        if (!image) {
            res.status(404).json({ message: 'Image not found' });
            return;
        }

        // Mark for immediate deletion
        image.markedForDeletion = true;
        image.deletionScheduledAt = new Date();
        await image.save();

        res.status(200).json({ message: 'Image scheduled for deletion', url: image.url });
    } catch (error: any) {
        logger.error('Error deleting image:', error);
        res.status(500).json({ message: 'Failed to delete image', error: error.message });
    }
};

/**
 * Manually trigger cleanup
 * POST /api/images/cleanup
 */
export const manualCleanup = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await triggerManualCleanup();

        res.status(200).json({
            message: 'Cleanup completed',
            ...result,
        });
    } catch (error: any) {
        logger.error('Error in manual cleanup:', error);
        res.status(500).json({ message: 'Cleanup failed', error: error.message });
    }
};

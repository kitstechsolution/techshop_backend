import cron from 'node-cron';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';
import UploadedImage from '../models/UploadedImage.js';
import { imageCleanup as cleanupConfig, storage as storageCfg } from '../config/config.js';
import { logger } from '../utils/logger.js';

let cleanupTask: cron.ScheduledTask | null = null;

/**
 * Mark images as unused if they're not referenced in any documents
 */
async function markUnusedImages(): Promise<number> {
    try {
        // Find images marked as used but check if they're actually referenced
        const usedImages = await UploadedImage.find({ isUsed: true });
        let markedCount = 0;

        for (const image of usedImages) {
            // If usedIn array is empty, mark as unused
            if (!image.usedIn || image.usedIn.length === 0) {
                image.isUsed = false;
                image.markedForDeletion = false;
                image.deletionScheduledAt = null;
                await image.save();
                markedCount++;
                logger.info(`Marked image as unused: ${image.url}`);
            }
        }

        return markedCount;
    } catch (error) {
        logger.error('Error marking unused images:', error);
        return 0;
    }
}

/**
 * Schedule unused images for deletion
 */
async function scheduleImageDeletion(): Promise<number> {
    try {
        const retentionMs = cleanupConfig.retentionHours * 60 * 60 * 1000;
        const cutoffDate = new Date(Date.now() - retentionMs);

        // Find unused images uploaded before cutoff that aren't already scheduled
        const imagesToSchedule = await UploadedImage.find({
            isUsed: false,
            markedForDeletion: false,
            uploadedAt: { $lt: cutoffDate },
        });

        let scheduledCount = 0;
        const deletionDate = new Date(Date.now() + retentionMs);

        for (const image of imagesToSchedule) {
            image.markedForDeletion = true;
            image.deletionScheduledAt = deletionDate;
            await image.save();
            scheduledCount++;
            logger.info(`Scheduled image for deletion: ${image.url} at ${deletionDate.toISOString()}`);
        }

        return scheduledCount;
    } catch (error) {
        logger.error('Error scheduling image deletion:', error);
        return 0;
    }
}

/**
 * Delete image file from local storage
 */
async function deleteLocalImage(filename: string): Promise<boolean> {
    try {
        const uploadsRoot = storageCfg.localDir || 'uploads';
        const imagesDir = path.join(uploadsRoot, 'images');

        // Delete main file and all variants
        const baseName = path.parse(filename).name;
        const patterns = [
            `${baseName}.webp`,
            `${baseName}-400w.webp`,
            `${baseName}-800w.webp`,
            `${baseName}-1200w.webp`,
            `${baseName}-thumb.webp`,
            filename, // Original file
        ];

        let deletedAny = false;
        for (const pattern of patterns) {
            try {
                const filePath = path.join(imagesDir, pattern);
                await fs.unlink(filePath);
                deletedAny = true;
            } catch (err) {
                // Ignore if file doesn't exist
            }
        }

        return deletedAny;
    } catch (error) {
        logger.error(`Error deleting local image ${filename}:`, error);
        return false;
    }
}

/**
 * Delete image from Cloudinary
 */
async function deleteCloudinaryImage(cloudinaryId: string): Promise<boolean> {
    try {
        if (storageCfg.provider !== 'cloudinary') {
            return false;
        }

        const result = await cloudinary.uploader.destroy(cloudinaryId);
        return result.result === 'ok';
    } catch (error) {
        logger.error(`Error deleting Cloudinary image ${cloudinaryId}:`, error);
        return false;
    }
}

/**
 * Execute scheduled deletions
 */
async function executeScheduledDeletions(): Promise<number> {
    try {
        const now = new Date();

        // Find images scheduled for deletion that are past their deletion time
        const imagesToDelete = await UploadedImage.find({
            markedForDeletion: true,
            deletionScheduledAt: { $lte: now },
        });

        let deletedCount = 0;

        for (const image of imagesToDelete) {
            let deleted = false;

            if (image.provider === 'cloudinary' && image.cloudinaryId) {
                deleted = await deleteCloudinaryImage(image.cloudinaryId);
            } else {
                deleted = await deleteLocalImage(image.filename);
            }

            if (deleted) {
                await UploadedImage.deleteOne({ _id: image._id });
                deletedCount++;
                logger.info(`Deleted image: ${image.url}`);
            } else {
                logger.warn(`Failed to delete image file, removing DB record anyway: ${image.url}`);
                await UploadedImage.deleteOne({ _id: image._id });
                deletedCount++;
            }
        }

        return deletedCount;
    } catch (error) {
        logger.error('Error executing scheduled deletions:', error);
        return 0;
    }
}

/**
 * Main cleanup routine
 */
async function runCleanup(): Promise<void> {
    if (!cleanupConfig.enabled) {
        logger.debug('Image cleanup is disabled');
        return;
    }

    logger.info('Starting image cleanup routine...');

    try {
        const marked = await markUnusedImages();
        const scheduled = await scheduleImageDeletion();
        const deleted = await executeScheduledDeletions();

        logger.info(`Image cleanup complete: ${marked} marked unused, ${scheduled} scheduled, ${deleted} deleted`);
    } catch (error) {
        logger.error('Error in cleanup routine:', error);
    }
}

/**
 * Start the cleanup scheduler
 */
export function startImageCleanup(): void {
    if (!cleanupConfig.enabled) {
        logger.info('Image cleanup scheduler is disabled');
        return;
    }

    // Validate cron schedule
    if (!cron.validate(cleanupConfig.schedule)) {
        logger.error(`Invalid cron schedule: ${cleanupConfig.schedule}`);
        return;
    }

    // Run immediately on startup to resume any pending deletions
    logger.info('Running initial image cleanup...');
    runCleanup().catch(err => logger.error('Initial cleanup failed:', err));

    // Schedule periodic cleanup
    cleanupTask = cron.schedule(cleanupConfig.schedule, () => {
        runCleanup().catch(err => logger.error('Scheduled cleanup failed:', err));
    });

    logger.info(`Image cleanup scheduler started with schedule: ${cleanupConfig.schedule}`);
}

/**
 * Stop the cleanup scheduler
 */
export function stopImageCleanup(): void {
    if (cleanupTask) {
        cleanupTask.stop();
        cleanupTask = null;
        logger.info('Image cleanup scheduler stopped');
    }
}

/**
 * Manual trigger for cleanup (for testing or admin use)
 */
export async function triggerManualCleanup(): Promise<{ marked: number; scheduled: number; deleted: number }> {
    logger.info('Manual cleanup triggered');

    const marked = await markUnusedImages();
    const scheduled = await scheduleImageDeletion();
    const deleted = await executeScheduledDeletions();

    return { marked, scheduled, deleted };
}

export default {
    startImageCleanup,
    stopImageCleanup,
    triggerManualCleanup,
    runCleanup,
};

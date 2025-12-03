import express, { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
    try {
        // Check database connection
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const isHealthy = dbStatus === 'connected';

        // Calculate uptime
        const uptime = process.uptime();
        const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

        // Get memory usage
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
        };

        const healthData = {
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: uptimeFormatted,
            uptimeSeconds: Math.floor(uptime),
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            database: {
                status: dbStatus,
                name: mongoose.connection.name || 'N/A'
            },
            memory: memoryUsageMB,
            pid: process.pid
        };

        // Return 200 if healthy, 503 if unhealthy
        const statusCode = isHealthy ? 200 : 503;

        logger.info(`Health check completed: ${healthData.status}`);
        res.status(statusCode).json(healthData);
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * @route   GET /api/health/ping
 * @desc    Simple ping endpoint for quick checks
 * @access  Public
 */
router.get('/ping', (_req: Request, res: Response): void => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

export default router;

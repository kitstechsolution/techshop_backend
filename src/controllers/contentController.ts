import { Request, Response } from 'express';
import { ContentSettings } from '../models/ContentSettings.js';

const sseClients: Response[] = [];

const broadcastContentUpdate = (payload: unknown) => {
    const data = `event: content_update\ndata:${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(data);
        } catch {}
    }
};

/**
 * Get content settings (Public endpoint)
 * GET /api/content/settings
 */
export const getContentSettings = async (req: Request, res: Response) => {
    try {
        const settings = await ContentSettings.getSettings();

        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            data: {
                company: settings.company,
                navigation: settings.navigation,
                homepage: settings.homepage,
                pageToggles: settings.pageToggles,
                seo: settings.seo,
                lastModified: settings.lastModified
            }
        });
    } catch (error) {
        console.error('Error fetching content settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch content settings'
        });
    }
};

/**
 * Get content settings with metadata (Admin endpoint)
 * GET /api/admin/content/settings
 */
export const getContentSettingsAdmin = async (req: Request, res: Response) => {
    try {
        const settings = await ContentSettings.getSettings();

        res.json({
            success: true,
            data: {
                company: settings.company,
                navigation: settings.navigation,
                homepage: settings.homepage,
                pageToggles: settings.pageToggles,
                seo: settings.seo,
                lastModified: settings.lastModified,
                createdAt: settings.createdAt,
                updatedAt: settings.updatedAt,
                _id: settings._id
            }
        });
    } catch (error) {
        console.error('Error fetching content settings (admin):', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch content settings'
        });
    }
};

/**
 * Update content settings (Admin endpoint)
 * PUT /api/admin/content/settings
 */
export const updateContentSettings = async (req: Request, res: Response) => {
    try {
        const { company, navigation, homepage, pageToggles, seo } = req.body;

        const settings = await ContentSettings.getSettings();

        // Update fields if provided
        if (company) {
            const mergedCompany = { ...settings.company, ...company } as typeof settings.company;
            if (company.social) {
                const cleanSocial: Record<string, string> = {};
                for (const key of Object.keys(company.social)) {
                    const val = company.social[key as keyof typeof company.social] as unknown as string;
                    cleanSocial[key] = typeof val === 'string' ? val.replace(/`/g, '').trim() : (val as unknown as string);
                }
                mergedCompany.social = { ...(settings.company.social || {}), ...cleanSocial };
            }
            settings.company = mergedCompany;
        }
        if (navigation) {
            settings.navigation = { ...settings.navigation, ...navigation };
        }
        if (homepage) {
            settings.homepage = { ...settings.homepage, ...homepage };
        }
        if (pageToggles) {
            settings.pageToggles = { ...settings.pageToggles, ...pageToggles };
        }
        if (seo) {
            settings.seo = { ...settings.seo, ...seo };
        }

        settings.lastModified = new Date();
        await settings.save();

        broadcastContentUpdate({ lastModified: settings.lastModified });

        res.json({
            success: true,
            message: 'Content settings updated successfully',
            data: {
                company: settings.company,
                navigation: settings.navigation,
                homepage: settings.homepage,
                pageToggles: settings.pageToggles,
                seo: settings.seo,
                lastModified: settings.lastModified
            }
        });
    } catch (error) {
        console.error('Error updating content settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update content settings'
        });
    }
};

/**
 * Reset content settings to defaults (Admin endpoint)
 * POST /api/admin/content/reset
 */
export const resetContentSettings = async (req: Request, res: Response) => {
    try {
        const settings = await ContentSettings.getSettings();

        // Delete and recreate with defaults
        await ContentSettings.deleteOne({ _id: settings._id });
        const newSettings = await ContentSettings.getSettings();

        res.json({
            success: true,
            message: 'Content settings reset to defaults',
            data: {
                company: newSettings.company,
                navigation: newSettings.navigation,
                homepage: newSettings.homepage,
                pageToggles: newSettings.pageToggles,
                seo: newSettings.seo,
                lastModified: newSettings.lastModified
            }
        });
    } catch (error) {
        console.error('Error resetting content settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset content settings'
        });
    }
};

/**
 * Get last modified timestamp (for polling)
 * GET /api/content/last-modified
 */
export const getLastModified = async (req: Request, res: Response) => {
    try {
        const settings = await ContentSettings.getSettings();

        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            data: {
                lastModified: settings.lastModified
            }
        });
    } catch (error) {
        console.error('Error fetching last modified:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch last modified timestamp'
        });
    }
};

export const streamContentUpdates = async (req: Request, res: Response) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        ;(res as any).flushHeaders?.();

        const settings = await ContentSettings.getSettings();
        res.write(`event: content_update\ndata:${JSON.stringify({ lastModified: settings.lastModified })}\n\n`);

        sseClients.push(res);

        req.on('close', () => {
            const idx = sseClients.indexOf(res);
            if (idx >= 0) sseClients.splice(idx, 1);
            try { res.end(); } catch {}
        });
    } catch (error) {
        try {
            res.status(500).end();
        } catch {}
    }
};

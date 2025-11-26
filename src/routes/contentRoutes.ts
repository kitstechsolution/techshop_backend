import express from 'express';
import {
    getContentSettings,
    getContentSettingsAdmin,
    updateContentSettings,
    resetContentSettings,
    getLastModified,
    streamContentUpdates
} from '../controllers/contentController.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/settings', getContentSettings);
router.get('/last-modified', getLastModified);
router.get('/stream', streamContentUpdates);

// Admin routes (protected with authentication middleware)
router.get('/admin/settings', adminAuth, getContentSettingsAdmin);
router.put('/admin/settings', adminAuth, updateContentSettings);
router.post('/admin/reset', adminAuth, resetContentSettings);

export default router;

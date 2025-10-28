import express from 'express';
import {
  getThemeSettings,
  getActiveTheme,
  applyTheme,
  getCustomThemes,
  getCustomThemeById,
  createCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  duplicateCustomTheme,
  getThemeHistory,
  getPresetThemes,
  exportCustomTheme,
  importCustomTheme
} from '../controllers/themeController.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required)
// These routes allow the frontend to fetch theme data for display
router.get('/active', getActiveTheme);
router.get('/presets', getPresetThemes);

// Admin routes (protected with authentication middleware)
// Theme settings
router.get('/admin/settings', adminAuth, getThemeSettings);

// Apply theme
router.post('/admin/apply', adminAuth, applyTheme);

// Custom themes CRUD
router.get('/admin/custom', adminAuth, getCustomThemes);
router.get('/admin/custom/:id', adminAuth, getCustomThemeById);
router.post('/admin/custom', adminAuth, createCustomTheme);
router.put('/admin/custom/:id', adminAuth, updateCustomTheme);
router.delete('/admin/custom/:id', adminAuth, deleteCustomTheme);

// Theme operations
router.post('/admin/custom/:id/duplicate', adminAuth, duplicateCustomTheme);
router.get('/admin/custom/:id/export', adminAuth, exportCustomTheme);
router.post('/admin/custom/import', adminAuth, importCustomTheme);

// Theme history
router.get('/admin/history', adminAuth, getThemeHistory);

export default router;

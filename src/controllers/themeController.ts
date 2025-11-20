import { Request, Response } from 'express';
import { ThemeSettings } from '../models/ThemeSettings.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get current theme settings
 * GET /api/admin/themes/settings
 */
export const getThemeSettings = async (req: Request, res: Response) => {
  try {
    const settings = await ThemeSettings.getSettings();

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching theme settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theme settings'
    });
  }
};

/**
 * Get active theme configuration
 * GET /api/themes/active
 */
export const getActiveTheme = async (req: Request, res: Response) => {
  try {
    const settings = await ThemeSettings.getSettings();

    const activeTheme = {
      id: settings.activeThemeId,
      type: settings.activeThemeType,
      theme: settings.activeThemeType === 'custom'
        ? settings.customThemes.find(t => t.id === settings.activeThemeId)
        : null
    };

    res.json({
      success: true,
      data: activeTheme
    });
  } catch (error) {
    console.error('Error fetching active theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active theme'
    });
  }
};

/**
 * Apply a theme (preset or custom)
 * POST /api/admin/themes/apply
 */
export const applyTheme = async (req: Request, res: Response) => {
  try {
    const { themeId, themeType, themeName } = req.body;

    // Validate input
    if (!themeId || !themeType || !themeName) {
      return res.status(400).json({
        success: false,
        message: 'Theme ID, type, and name are required'
      });
    }

    if (!['preset', 'custom'].includes(themeType)) {
      return res.status(400).json({
        success: false,
        message: 'Theme type must be either "preset" or "custom"'
      });
    }

    const settings = await ThemeSettings.getSettings();

    // Verify theme exists if it's custom
    if (themeType === 'custom') {
      const theme = settings.customThemes.find(t => t.id === themeId);
      if (!theme) {
        return res.status(404).json({
          success: false,
          message: 'Custom theme not found'
        });
      }
    }

    // Apply the theme
    settings.applyTheme(themeId, themeType, themeName);
    await settings.save();

    res.json({
      success: true,
      message: 'Theme applied successfully',
      data: {
        activeThemeId: settings.activeThemeId,
        activeThemeType: settings.activeThemeType
      }
    });
  } catch (error) {
    console.error('Error applying theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply theme'
    });
  }
};

/**
 * Get all custom themes
 * GET /api/admin/themes/custom
 */
export const getCustomThemes = async (req: Request, res: Response) => {
  try {
    const settings = await ThemeSettings.getSettings();

    res.json({
      success: true,
      data: settings.customThemes
    });
  } catch (error) {
    console.error('Error fetching custom themes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom themes'
    });
  }
};

/**
 * Get a specific custom theme by ID
 * GET /api/admin/themes/custom/:id
 */
export const getCustomThemeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const settings = await ThemeSettings.getSettings();

    const theme = settings.customThemes.find(t => t.id === id);

    if (!theme) {
      return res.status(404).json({
        success: false,
        message: 'Custom theme not found'
      });
    }

    res.json({
      success: true,
      data: theme
    });
  } catch (error) {
    console.error('Error fetching custom theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom theme'
    });
  }
};

/**
 * Create a new custom theme
 * POST /api/admin/themes/custom
 */
export const createCustomTheme = async (req: Request, res: Response) => {
  try {
    const { name, description, industry, colors, typography, semanticColors, brand, effects } = req.body;

    // Validate required fields
    if (!name || !colors || !typography || !semanticColors || !brand) {
      return res.status(400).json({
        success: false,
        message: 'Missing required theme fields'
      });
    }

    const settings = await ThemeSettings.getSettings();

    // Check if theme with same name already exists
    const existingTheme = settings.customThemes.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existingTheme) {
      return res.status(400).json({
        success: false,
        message: 'A theme with this name already exists'
      });
    }

    // Create new theme
    const newTheme = {
      id: uuidv4(),
      name,
      description: description || '',
      industry: industry || 'custom',
      colors,
      typography,
      semanticColors,
      brand,
      effects,
      dateCreated: new Date(),
      dateModified: new Date(),
      isActive: false
    };

    settings.customThemes.push(newTheme);
    settings.addToHistory(newTheme.id, newTheme.name, 'created');
    await settings.save();

    res.status(201).json({
      success: true,
      message: 'Custom theme created successfully',
      data: newTheme
    });
  } catch (error) {
    console.error('Error creating custom theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create custom theme'
    });
  }
};

/**
 * Update an existing custom theme
      settings.addToHistory(theme.id, theme.name, 'modified', changes.join(', '));
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Custom theme updated successfully',
      data: theme
    });
  } catch (error) {
    console.error('Error updating custom theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update custom theme'
    });
  }
};

/**
 * Delete a custom theme
 * DELETE /api/admin/themes/custom/:id
 */
export const deleteCustomTheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const settings = await ThemeSettings.getSettings();

    // Find theme
    const themeIndex = settings.customThemes.findIndex(t => t.id === id);

    if (themeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Custom theme not found'
      });
    }

    const theme = settings.customThemes[themeIndex];

    // Check if the theme is currently active
    if (settings.activeThemeId === id && settings.activeThemeType === 'custom') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the currently active theme. Please apply a different theme first.'
      });
    }

    // Remove theme
    const themeName = theme.name;
    settings.customThemes.splice(themeIndex, 1);
    settings.addToHistory(id, themeName, 'deleted');
    await settings.save();

    res.json({
      success: true,
      message: 'Custom theme deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting custom theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete custom theme'
    });
  }
};

/**
 * Duplicate a custom theme
 * POST /api/admin/themes/custom/:id/duplicate
 */
export const duplicateCustomTheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'New theme name is required'
      });
    }

    const settings = await ThemeSettings.getSettings();

    // Find original theme
    const originalTheme = settings.customThemes.find(t => t.id === id);

    if (!originalTheme) {
      return res.status(404).json({
        success: false,
        message: 'Original theme not found'
      });
    }

    // Check if new name already exists
    const nameExists = settings.customThemes.some(
      t => t.name.toLowerCase() === name.toLowerCase()
    );

    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'A theme with this name already exists'
      });
    }

    // Create duplicate
    const duplicatedTheme = {
      id: uuidv4(),
      name,
      description: `Copy of ${originalTheme.name}`,
      industry: originalTheme.industry,
      colors: JSON.parse(JSON.stringify(originalTheme.colors)),
      typography: JSON.parse(JSON.stringify(originalTheme.typography)),
      semanticColors: JSON.parse(JSON.stringify(originalTheme.semanticColors)),
      brand: JSON.parse(JSON.stringify(originalTheme.brand)),
      effects: originalTheme.effects ? JSON.parse(JSON.stringify(originalTheme.effects)) : undefined,
      dateCreated: new Date(),
      dateModified: new Date(),
      isActive: false
    };

    settings.customThemes.push(duplicatedTheme);
    settings.addToHistory(duplicatedTheme.id, duplicatedTheme.name, 'created', `Duplicated from ${originalTheme.name}`);
    await settings.save();

    res.status(201).json({
      success: true,
      message: 'Theme duplicated successfully',
      data: duplicatedTheme
    });
  } catch (error) {
    console.error('Error duplicating custom theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate custom theme'
    });
  }
};

/**
 * Get theme history
 * GET /api/admin/themes/history
 */
export const getThemeHistory = async (req: Request, res: Response) => {
  try {
    const settings = await ThemeSettings.getSettings();

    // Return history in reverse chronological order
    const history = [...settings.history].reverse();

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching theme history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theme history'
    });
  }
};

/**
 * Get available preset themes
 * GET /api/themes/presets
 */
export const getPresetThemes = async (req: Request, res: Response) => {
  try {
    const settings = await ThemeSettings.getSettings();

    res.json({
      success: true,
      data: settings.presetThemes
    });
  } catch (error) {
    console.error('Error fetching preset themes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preset themes'
    });
  }
};

/**
 * Export a custom theme as JSON
 * GET /api/admin/themes/custom/:id/export
 */
export const exportCustomTheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const settings = await ThemeSettings.getSettings();

    const theme = settings.customThemes.find(t => t.id === id);

    if (!theme) {
      return res.status(404).json({
        success: false,
        message: 'Custom theme not found'
      });
    }

    // Create exportable theme object (without MongoDB-specific fields)
    const exportTheme = {
      name: theme.name,
      description: theme.description,
      industry: theme.industry,
      colors: theme.colors,
      typography: theme.typography,
      semanticColors: theme.semanticColors,
      brand: theme.brand,
      effects: theme.effects,
      exportedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: exportTheme
    });
  } catch (error) {
    console.error('Error exporting custom theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export custom theme'
    });
  }
};

/**
 * Import a custom theme from JSON
 * POST /api/admin/themes/custom/import
 */
export const importCustomTheme = async (req: Request, res: Response) => {
  try {
    const { theme, name } = req.body;

    // Validate input
    if (!theme || !name) {
      return res.status(400).json({
        success: false,
        message: 'Theme data and name are required'
      });
    }

    // Validate required theme fields
    if (!theme.colors || !theme.typography || !theme.semanticColors || !theme.brand) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theme data: missing required fields'
      });
    }

    const settings = await ThemeSettings.getSettings();

    // Check if theme with same name already exists
    const existingTheme = settings.customThemes.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existingTheme) {
      return res.status(400).json({
        success: false,
        message: 'A theme with this name already exists'
      });
    }

    // Create new theme from import
    const newTheme = {
      id: uuidv4(),
      name,
      description: theme.description || 'Imported theme',
      industry: theme.industry || 'custom',
      colors: theme.colors,
      typography: theme.typography,
      semanticColors: theme.semanticColors,
      brand: theme.brand,
      effects: theme.effects,
      dateCreated: new Date(),
      dateModified: new Date(),
      isActive: false
    };

    settings.customThemes.push(newTheme);
    settings.addToHistory(newTheme.id, newTheme.name, 'created', 'Imported from JSON');
    await settings.save();

    res.status(201).json({
      success: true,
      message: 'Theme imported successfully',
      data: newTheme
    });
  } catch (error) {
    console.error('Error importing custom theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import custom theme'
    });
  }
};

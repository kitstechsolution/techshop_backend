import mongoose, { Schema, Document } from 'mongoose';

// Interface for color palette
interface ColorPalette {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

// Interface for typography settings
interface Typography {
  fontFamily: {
    sans: string;
    serif: string;
    mono: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
  };
  fontWeight: {
    thin: string;
    extralight: string;
    light: string;
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
    extrabold: string;
    black: string;
  };
  lineHeight: {
    none: string;
    tight: string;
    snug: string;
    normal: string;
    relaxed: string;
    loose: string;
  };
}

// Interface for theme colors
interface ThemeColors {
  primary: ColorPalette;
  secondary: ColorPalette;
  gray: ColorPalette;
  success?: string;
  warning?: string;
  error?: string;
  info?: string;
}

// Interface for semantic colors
interface SemanticColors {
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  border: {
    light: string;
    medium: string;
    dark: string;
  };
}

// Interface for brand settings
interface BrandSettings {
  name: string;
  logo?: string;
  favicon?: string;
  socialImage?: string;
}

// Interface for visual effects
interface Effects {
  glass: {
    opacity: string;
    blur: string;
    borderOpacity: string;
  };
  shadows: {
    soft: string;
    medium: string;
    hard: string;
  };
}

// Interface for custom theme
interface ICustomTheme {
  id: string;
  name: string;
  description: string;
  industry: 'fashion' | 'grocery' | 'tech' | 'beauty' | 'sports' | 'home' | 'jewelry' | 'books' | 'custom';
  colors: ThemeColors;
  typography: Typography;
  semanticColors: SemanticColors;
  brand: BrandSettings;
  effects?: Effects;
  dateCreated: Date;
  dateModified: Date;
  isActive: boolean;
}

// Interface for theme history entry
interface IThemeHistoryEntry {
  themeId: string;
  themeName: string;
  action: 'created' | 'modified' | 'applied' | 'deleted';
  timestamp: Date;
  changes?: string;
}

// Interface for ThemeSettings document
export interface IThemeSettings extends Document {
  activeThemeId: string;
  activeThemeType: 'preset' | 'custom';
  customThemes: ICustomTheme[];
  presetThemes: string[];
  history: IThemeHistoryEntry[];
  lastModified: Date;
  createdAt: Date;
  updatedAt: Date;
  addToHistory(themeId: string, themeName: string, action: string, changes?: string): void;
  getActiveTheme(): ICustomTheme | null;
  applyTheme(themeId: string, themeType: 'preset' | 'custom', themeName: string): void;
}

// Interface for ThemeSettings Model (static methods)
export interface IThemeSettingsModel extends mongoose.Model<IThemeSettings> {
  getSettings(): Promise<IThemeSettings>;
}

// Schema for color palette
const ColorPaletteSchema = new Schema({
  50: { type: String, required: true },
  100: { type: String, required: true },
  200: { type: String, required: true },
  300: { type: String, required: true },
  400: { type: String, required: true },
  500: { type: String, required: true },
  600: { type: String, required: true },
  700: { type: String, required: true },
  800: { type: String, required: true },
  900: { type: String, required: true },
  950: { type: String, required: true }
}, { _id: false });

// Schema for theme colors
const ThemeColorsSchema = new Schema({
  primary: { type: ColorPaletteSchema, required: true },
  secondary: { type: ColorPaletteSchema, required: true },
  gray: { type: ColorPaletteSchema, required: true },
  success: { type: String },
  warning: { type: String },
  error: { type: String },
  info: { type: String }
}, { _id: false });

// Schema for typography
const TypographySchema = new Schema({
  fontFamily: {
    sans: { type: String, required: true },
    serif: { type: String, required: true },
    mono: { type: String, required: true }
  },
  fontSize: {
    xs: { type: String, default: '0.75rem' },
    sm: { type: String, default: '0.875rem' },
    base: { type: String, default: '1rem' },
    lg: { type: String, default: '1.125rem' },
    xl: { type: String, default: '1.25rem' },
    '2xl': { type: String, default: '1.5rem' },
    '3xl': { type: String, default: '1.875rem' },
    '4xl': { type: String, default: '2.25rem' },
    '5xl': { type: String, default: '3rem' }
  },
  fontWeight: {
    thin: { type: String, default: '100' },
    extralight: { type: String, default: '200' },
    light: { type: String, default: '300' },
    normal: { type: String, default: '400' },
    medium: { type: String, default: '500' },
    semibold: { type: String, default: '600' },
    bold: { type: String, default: '700' },
    extrabold: { type: String, default: '800' },
    black: { type: String, default: '900' }
  },
  lineHeight: {
    none: { type: String, default: '1' },
    tight: { type: String, default: '1.25' },
    snug: { type: String, default: '1.375' },
    normal: { type: String, default: '1.5' },
    relaxed: { type: String, default: '1.625' },
    loose: { type: String, default: '2' }
  }
}, { _id: false });

// Schema for semantic colors
const SemanticColorsSchema = new Schema({
  text: {
    primary: { type: String, required: true },
    secondary: { type: String, required: true },
    tertiary: { type: String, required: true },
    inverse: { type: String, required: true }
  },
  background: {
    primary: { type: String, required: true },
    secondary: { type: String, required: true },
    tertiary: { type: String, required: true }
  },
  border: {
    light: { type: String, required: true },
    medium: { type: String, required: true },
    dark: { type: String, required: true }
  }
}, { _id: false });

// Schema for brand settings
const BrandSettingsSchema = new Schema({
  name: { type: String, required: true },
  logo: { type: String },
  favicon: { type: String },
  socialImage: { type: String }
}, { _id: false });

// Schema for visual effects
const EffectsSchema = new Schema({
  glass: {
    opacity: { type: String, default: '0.7' },
    blur: { type: String, default: '10px' },
    borderOpacity: { type: String, default: '0.3' }
  },
  shadows: {
    soft: { type: String, default: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' },
    medium: { type: String, default: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
    hard: { type: String, default: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }
  }
}, { _id: false });

// Schema for custom theme
const CustomThemeSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  industry: {
    type: String,
    enum: ['fashion', 'grocery', 'tech', 'beauty', 'sports', 'home', 'jewelry', 'books', 'custom'],
    default: 'custom'
  },
  colors: { type: ThemeColorsSchema, required: true },
  typography: { type: TypographySchema, required: true },
  semanticColors: { type: SemanticColorsSchema, required: true },
  brand: { type: BrandSettingsSchema, required: true },
  effects: { type: EffectsSchema },
  dateCreated: { type: Date, default: Date.now },
  dateModified: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: false }
}, { _id: false });

// Schema for theme history
const ThemeHistorySchema = new Schema({
  themeId: { type: String, required: true },
  themeName: { type: String, required: true },
  action: {
    type: String,
    enum: ['created', 'modified', 'applied', 'deleted'],
    required: true
  },
  timestamp: { type: Date, default: Date.now },
  changes: { type: String }
}, { _id: false });

// Main ThemeSettings schema
const ThemeSettingsSchema = new Schema({
  activeThemeId: {
    type: String,
    required: true,
    default: 'default'
  },
  activeThemeType: {
    type: String,
    enum: ['preset', 'custom'],
    default: 'preset'
  },
  customThemes: {
    type: [CustomThemeSchema],
    default: []
  },
  presetThemes: {
    type: [String],
    default: ['default', 'fashion', 'grocery', 'tech', 'beauty']
  },
  history: {
    type: [ThemeHistorySchema],
    default: []
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for fast lookups
ThemeSettingsSchema.index({ 'customThemes.id': 1 }, { unique: true });

// Method to add theme to history
ThemeSettingsSchema.methods.addToHistory = function (themeId: string, themeName: string, action: string, changes?: string) {
  this.history.push({
    themeId,
    themeName,
    action,
    timestamp: new Date(),
    changes
  });

  // Keep only last 100 history entries
  if (this.history.length > 100) {
    this.history = this.history.slice(-100);
  }

  this.lastModified = new Date();
};

// Method to get active theme
ThemeSettingsSchema.methods.getActiveTheme = function () {
  if (this.activeThemeType === 'custom') {
    return this.customThemes.find((theme: ICustomTheme) => theme.id === this.activeThemeId);
  }
  return null; // For preset themes, frontend handles them
};

// Method to apply theme
ThemeSettingsSchema.methods.applyTheme = function (themeId: string, themeType: 'preset' | 'custom', themeName: string) {
  // Deactivate all custom themes
  this.customThemes.forEach((theme: ICustomTheme) => {
    theme.isActive = false;
  });

  // Activate the selected theme if it's custom
  if (themeType === 'custom') {
    const theme = this.customThemes.find((t: ICustomTheme) => t.id === themeId);
    if (theme) {
      theme.isActive = true;
    }
  }

  this.activeThemeId = themeId;
  this.activeThemeType = themeType;
  this.addToHistory(themeId, themeName, 'applied');
  this.lastModified = new Date();
};

// Static method to get or create settings
ThemeSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();

  if (!settings) {
    // Create default settings
    settings = await this.create({
      activeThemeId: 'default',
      activeThemeType: 'preset',
      customThemes: [],
      presetThemes: ['default', 'fashion', 'grocery', 'tech', 'beauty'],
      history: []
    });
  }

  return settings;
};

export const ThemeSettings = mongoose.model<IThemeSettings, IThemeSettingsModel>('ThemeSettings', ThemeSettingsSchema);

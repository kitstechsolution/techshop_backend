import mongoose, { Schema, Document } from 'mongoose';

// Interface for company information
interface CompanyInfo {
    name: string;
    tagline: string;
    description: string;
    foundedYear?: number;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };
    contact?: {
        email?: string;
        phone?: string;
        customerServiceHours?: string;
    };
    social?: {
        facebook?: string;
        twitter?: string;
        instagram?: string;
        youtube?: string;
    };
}

// Interface for navigation
interface Navigation {
    header?: Array<{ name: string; path: string }>;
    footer?: {
        shop?: Array<{ name: string; path: string }>;
        company?: Array<{ name: string; path: string }>;
        support?: Array<{ name: string; path: string }>;
        legal?: Array<{ name: string; path: string }>;
    };
}

// Interface for homepage content
interface HomepageContent {
    hero?: {
        title?: string;
        subtitle?: string;
        cta?: string;
        ctaLink?: string;
        secondaryCta?: string;
        secondaryCtaLink?: string;
        backgroundImage?: string;
    };
    carousel?: Array<{
        image: string;
        link?: string;
    }>;
    promotionalBanner?: {
        title?: string;
        description?: string;
        variant?: 'full' | 'compact' | 'side';
        dismissible?: boolean;
        backgroundImage?: string;
        backgroundColor?: string;
        buttonText?: string;
        buttonLink?: string;
        countdownEnabled?: boolean;
        countdownTo?: string;
    };
    layout?: {
        sections: string[];
        visible: Record<string, boolean>;
    };
    categoriesImages?: Record<string, string>;
    features?: Array<{
        title?: string;
        description?: string;
        icon?: string;
    }>;
    categories?: {
        title?: string;
        subtitle?: string;
        items?: Array<{
            name?: string;
            image?: string;
            description?: string;
            link?: string;
        }>;
    };
    featuredProducts?: {
        title?: string;
        subtitle?: string;
        viewAllText?: string;
        viewAllLink?: string;
    };
    testimonials?: {
        title?: string;
        subtitle?: string;
        items?: Array<{
            text?: string;
            author?: string;
            role?: string;
            avatar?: string;
        }>;
    };
    newsletter?: {
        title?: string;
        subtitle?: string;
        buttonText?: string;
        privacyText?: string;
        privacyLink?: string;
    };
}

// Interface for page toggles
interface PageToggles {
    categories: boolean;
    projects: boolean;
    tutorials: boolean;
}

// Interface for SEO settings
interface SEOSettings {
    defaultTitle?: string;
    defaultDescription?: string;
    defaultKeywords?: string;
    siteUrl?: string;
    ogImage?: string;
}

// Main ContentSettings document interface
export interface IContentSettings extends Document {
    company: CompanyInfo;
    navigation: Navigation;
    homepage: HomepageContent;
    pageToggles: PageToggles;
    seo: SEOSettings;
    lastModified: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ContentSettings Model interface (static methods)
export interface IContentSettingsModel extends mongoose.Model<IContentSettings> {
    getSettings(): Promise<IContentSettings>;
}

// Schema for company info
const CompanyInfoSchema = new Schema({
    name: { type: String, required: true },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    foundedYear: { type: Number },
    address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        pincode: { type: String }
    },
    contact: {
        email: { type: String },
        phone: { type: String },
        customerServiceHours: { type: String }
    },
    social: {
        facebook: { type: String },
        twitter: { type: String },
        instagram: { type: String },
        youtube: { type: String }
    }
}, { _id: false });

// Schema for navigation
const NavigationSchema = new Schema({
    header: [{
        name: { type: String, required: true },
        path: { type: String, required: true }
    }],
    footer: {
        shop: [{
            name: { type: String, required: true },
            path: { type: String, required: true }
        }],
        company: [{
            name: { type: String, required: true },
            path: { type: String, required: true }
        }],
        support: [{
            name: { type: String, required: true },
            path: { type: String, required: true }
        }],
        legal: [{
            name: { type: String, required: true },
            path: { type: String, required: true }
        }]
    }
}, { _id: false });

// Schema for homepage
const HomepageSchema = new Schema({
    hero: {
        title: { type: String },
        subtitle: { type: String },
        cta: { type: String },
        ctaLink: { type: String },
        secondaryCta: { type: String },
        secondaryCtaLink: { type: String },
        backgroundImage: { type: String }
    },
    carousel: [{
        image: { type: String },
        link: { type: String }
    }],
    promotionalBanner: {
        title: { type: String },
        description: { type: String },
        variant: { type: String },
        dismissible: { type: Boolean },
        backgroundImage: { type: String },
        backgroundColor: { type: String },
        buttonText: { type: String },
        buttonLink: { type: String },
        countdownEnabled: { type: Boolean },
        countdownTo: { type: String } // Store as ISO string
    },
    layout: {
        sections: [{ type: String }],
        visible: { type: Map, of: Boolean }
    },
    categoriesImages: { type: Map, of: String },
    features: [{
        title: { type: String },
        description: { type: String },
        icon: { type: String }
    }],
    categories: {
        title: { type: String },
        subtitle: { type: String },
        items: [{
            name: { type: String },
            image: { type: String },
            description: { type: String },
            link: { type: String }
        }]
    },
    featuredProducts: {
        title: { type: String },
        subtitle: { type: String },
        viewAllText: { type: String },
        viewAllLink: { type: String }
    },
    testimonials: {
        title: { type: String },
        subtitle: { type: String },
        items: [{
            text: { type: String },
            author: { type: String },
            role: { type: String },
            avatar: { type: String }
        }]
    },
    newsletter: {
        title: { type: String },
        subtitle: { type: String },
        buttonText: { type: String },
        privacyText: { type: String },
        privacyLink: { type: String }
    }
}, { _id: false });

// Schema for page toggles
const PageTogglesSchema = new Schema({
    categories: { type: Boolean, default: true },
    projects: { type: Boolean, default: true },
    tutorials: { type: Boolean, default: true }
}, { _id: false });

// Schema for SEO settings
const SEOSettingsSchema = new Schema({
    defaultTitle: { type: String },
    defaultDescription: { type: String },
    defaultKeywords: { type: String },
    siteUrl: { type: String },
    ogImage: { type: String }
}, { _id: false });

// Main ContentSettings schema
const ContentSettingsSchema = new Schema({
    company: { type: CompanyInfoSchema, required: true },
    navigation: { type: NavigationSchema, required: true },
    homepage: { type: HomepageSchema, required: true },
    pageToggles: { type: PageTogglesSchema, default: () => ({ categories: true, projects: true, tutorials: true }) },
    seo: { type: SEOSettingsSchema },
    lastModified: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Update lastModified on save
ContentSettingsSchema.pre('save', function (next) {
    this.lastModified = new Date();
    next();
});

// Static method to get or create settings (singleton pattern)
ContentSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();

    if (!settings) {
        // Create default settings based on content.ts defaults
        settings = await this.create({
            company: {
                name: 'TechShop',
                tagline: 'Your Ultimate Tech Store',
                description: 'We offer premium tech products at affordable prices.',
                foundedYear: 2023,
                address: {
                    street: '123 Tech Street',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    country: 'India',
                    pincode: '560001'
                },
                contact: {
                    email: 'support@techshop.com',
                    phone: '+91 1234567890',
                    customerServiceHours: 'Monday to Friday, 9:00 AM to 6:00 PM IST'
                },
                social: {
                    facebook: 'https://facebook.com/techshop',
                    twitter: 'https://twitter.com/techshop',
                    instagram: 'https://instagram.com/techshop',
                    youtube: 'https://youtube.com/techshop'
                }
            },
            navigation: {
                header: [
                    { name: 'Home', path: '/' },
                    { name: 'Products', path: '/products' },
                    { name: 'Categories', path: '/categories' },
                    { name: 'Projects', path: '/projects' },
                    { name: 'Tutorials', path: '/tutorials' }
                ],
                footer: {
                    shop: [
                        { name: 'All Products', path: '/products' },
                        { name: 'New Arrivals', path: '/products?sort=newest' },
                        { name: 'Best Sellers', path: '/products?sort=bestsellers' },
                        { name: 'Discounts', path: '/products?discount=true' }
                    ],
                    company: [
                        { name: 'About Us', path: '/about' },
                        { name: 'Contact', path: '/contact' },
                        { name: 'Careers', path: '/careers' },
                        { name: 'Blog', path: '/blog' }
                    ],
                    support: [
                        { name: 'Help Center', path: '/help' },
                        { name: 'Shipping', path: '/shipping' },
                        { name: 'Returns', path: '/returns' },
                        { name: 'Warranty', path: '/warranty' }
                    ],
                    legal: [
                        { name: 'Terms of Service', path: '/terms' },
                        { name: 'Privacy Policy', path: '/privacy' },
                        { name: 'Refund Policy', path: '/refund' },
                        { name: 'Cookie Policy', path: '/cookie' }
                    ]
                }
            },
            homepage: {
                hero: {
                    title: 'The Future of Tech is Here',
                    subtitle: 'Explore our wide range of premium tech products at unbeatable prices',
                    cta: 'Shop Now',
                    ctaLink: '/products',
                    secondaryCta: 'Learn More',
                    secondaryCtaLink: '/about',
                    backgroundImage: '/images/hero-background.jpg'
                },
                carousel: [
                    { image: '/images/hero-slide-1.jpg', link: '/products' },
                    { image: '/images/hero-slide-2.jpg', link: '/categories' }
                ],
                promotionalBanner: {
                    title: 'Summer Sale',
                    description: 'Up to 50% off on selected items',
                    variant: 'full',
                    dismissible: true,
                    backgroundColor: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    buttonText: 'Shop Sale',
                    buttonLink: '/products?sale=true',
                    countdownEnabled: true,
                    countdownTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                },
                layout: {
                    sections: ['hero', 'trustBadges', 'featuredProducts', 'promotionalBanner', 'categoryShowcase', 'testimonials', 'newsletter'],
                    visible: {
                        hero: true,
                        trustBadges: true,
                        featuredProducts: true,
                        promotionalBanner: true,
                        categoryShowcase: true,
                        testimonials: true,
                        newsletter: true
                    }
                },
                categoriesImages: {},
                features: [
                    {
                        title: 'Fast Delivery',
                        description: 'Free shipping on orders above ₹500',
                        icon: 'truck'
                    },
                    {
                        title: 'Secure Payments',
                        description: 'Multiple payment options available',
                        icon: 'shield-check'
                    },
                    {
                        title: '24/7 Support',
                        description: 'Get help whenever you need it',
                        icon: 'headset'
                    },
                    {
                        title: 'Easy Returns',
                        description: '30-day hassle-free returns',
                        icon: 'arrow-path'
                    }
                ]
            },
            pageToggles: {
                categories: true,
                projects: true,
                tutorials: true
            },
            seo: {
                defaultTitle: 'TechShop - Your Ultimate Tech Store',
                defaultDescription: 'Shop the latest tech products including smartphones, laptops, accessories and more.',
                defaultKeywords: 'tech, electronics, smartphones, laptops, gadgets, accessories',
                siteUrl: 'https://techshop.com',
                ogImage: 'https://techshop.com/og-image.jpg'
            }
        });
    }

    return settings;
};

export const ContentSettings = mongoose.model<IContentSettings, IContentSettingsModel>('ContentSettings', ContentSettingsSchema);

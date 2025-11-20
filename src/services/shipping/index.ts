/**
 * Barrel export for shipping module - maintains backward compatibility
 */

// Re-export all types
export * from './core/types.js';

// Export the base provider class
export { ShippingAggregatorProvider } from './providers/base/ShippingProvider.js';

// Export all provider implementations
export { ShiprocketProvider } from './providers/ShiprocketProvider.js';
export { ShipwayProvider } from './providers/ShipwayProvider.js';
export { ShipyaariProvider } from './providers/ShipyaariProvider.js';

// Export the main shipping service
export { default } from './core/ShippingService.js';
export { testShippingProvider } from './core/ShippingService.js';

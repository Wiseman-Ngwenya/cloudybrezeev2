// ============================================================
// CloudyBreeze E-Commerce System
// Settings Service
// ============================================================
// Handles all store settings business logic.
//
// Responsibilities:
// - Retrieve store settings (public and admin)
// - Update store settings (admin only)
// - Singleton pattern enforcement (single settings row)
// - Provide defaults for missing settings
// ============================================================

const { serviceClient } = require('../config/supabase');
const { NotFoundError } = require('../middleware/errorHandler');

// ============================================================
// Default Settings
// ============================================================
// Used when no settings row exists in the database.
// Ensures the frontend always receives valid configuration.
// ============================================================

const DEFAULT_SETTINGS = {
    store_name: 'CloudyBreeze',
    email: 'hello@cloudybreeze.com',
    phone: null,
    address: null,
    currency: 'USD',
    shipping_cost: 5.00,
    free_shipping_threshold: null,
    facebook: null,
    instagram: null,
    twitter: null,
    seo_title: 'CloudyBreeze - Premium Humidifiers & Aroma Diffusers',
    seo_description: 'Shop premium humidifiers and aroma diffusers at CloudyBreeze.',
};

// ============================================================
// Get Settings
// ============================================================

/**
 * Get current store settings.
 * If no settings row exists, returns defaults and optionally creates one.
 * Used by both public and admin endpoints.
 *
 * @param {boolean} [createIfMissing=false] - Create default settings row if none exists
 * @returns {Promise<Object>} Current store settings
 */
async function getSettings(createIfMissing = false) {
    const { data, error } = await serviceClient
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching store settings:', error);
        return DEFAULT_SETTINGS;
    }

    if (data) {
        return data;
    }

    // No settings row exists
    if (createIfMissing) {
        // Create default settings row
        const { data: created, error: createError } = await serviceClient
            .from('store_settings')
            .insert(DEFAULT_SETTINGS)
            .select()
            .single();

        if (createError) {
            console.error('Error creating default store settings:', createError);
            return DEFAULT_SETTINGS;
        }

        return created;
    }

    // Return defaults without creating (for public read)
    return DEFAULT_SETTINGS;
}

// ============================================================
// Update Settings
// ============================================================

/**
 * Update store settings.
 * Creates the settings row if it doesn't exist.
 * Only provided fields are updated; all others remain unchanged.
 *
 * @param {Object} settingsData - Settings fields to update
 * @returns {Promise<Object>} Updated store settings
 */
async function updateSettings(settingsData) {
    // Get current settings (creates row if missing)
    let currentSettings = await getSettings(true);

    // Extract updatable fields
    const {
        store_name,
        email,
        phone,
        address,
        currency,
        shipping_cost,
        free_shipping_threshold,
        facebook,
        instagram,
        twitter,
        seo_title,
        seo_description,
    } = settingsData;

    // Build update object with only provided fields
    const updates = {};

    if (store_name !== undefined) updates.store_name = store_name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (currency !== undefined) updates.currency = currency;
    if (shipping_cost !== undefined) updates.shipping_cost = shipping_cost;
    if (free_shipping_threshold !== undefined) updates.free_shipping_threshold = free_shipping_threshold;
    if (facebook !== undefined) updates.facebook = facebook;
    if (instagram !== undefined) updates.instagram = instagram;
    if (twitter !== undefined) updates.twitter = twitter;
    if (seo_title !== undefined) updates.seo_title = seo_title;
    if (seo_description !== undefined) updates.seo_description = seo_description;

    // If no fields to update, return current settings
    if (Object.keys(updates).length === 0) {
        return currentSettings;
    }

    // Update the existing row
    const { data, error } = await serviceClient
        .from('store_settings')
        .update(updates)
        .eq('id', currentSettings.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating store settings:', error);
        throw error;
    }

    return data;
}

// ============================================================
// Get Public Settings
// ============================================================

/**
 * Get settings formatted for public display.
 * Strips internal fields and provides safe defaults.
 * Used by the public API endpoint.
 *
 * @returns {Promise<Object>} Public-safe store settings
 */
async function getPublicSettings() {
    const settings = await getSettings(false);

    return {
        storeName: settings.store_name,
        email: settings.email,
        phone: settings.phone || null,
        address: settings.address || null,
        currency: settings.currency,
        shippingCost: parseFloat(settings.shipping_cost || 0),
        freeShippingThreshold: settings.free_shipping_threshold
            ? parseFloat(settings.free_shipping_threshold)
            : null,
        social: {
            facebook: settings.facebook || null,
            instagram: settings.instagram || null,
            twitter: settings.twitter || null,
        },
        seo: {
            title: settings.seo_title || DEFAULT_SETTINGS.seo_title,
            description: settings.seo_description || DEFAULT_SETTINGS.seo_description,
        },
    };
}

// ============================================================
// Specific Settings Helpers
// ============================================================

/**
 * Get shipping cost from settings.
 * Used by order service to calculate shipping.
 *
 * @returns {Promise<number>} Shipping cost
 */
async function getShippingCost() {
    const settings = await getSettings(false);
    return parseFloat(settings.shipping_cost || 0);
}

/**
 * Get free shipping threshold from settings.
 * Used by order service to determine free shipping eligibility.
 *
 * @returns {Promise<number|null>} Free shipping threshold or null
 */
async function getFreeShippingThreshold() {
    const settings = await getSettings(false);
    return settings.free_shipping_threshold
        ? parseFloat(settings.free_shipping_threshold)
        : null;
}

/**
 * Get store currency.
 *
 * @returns {Promise<string>} Currency code (default: USD)
 */
async function getCurrency() {
    const settings = await getSettings(false);
    return settings.currency || 'USD';
}

// ============================================================
// Export
// ============================================================
module.exports = {
    getSettings,
    updateSettings,
    getPublicSettings,
    getShippingCost,
    getFreeShippingThreshold,
    getCurrency,
};
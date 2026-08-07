// ============================================================
// CloudyBreeze E-Commerce System
// Settings Service
// ============================================================
// Handles all store settings business logic.
//
// Responsibilities:
// - Retrieve store settings (public and admin)
// - Update store settings (admin only)
// - Manage shipping countries for checkout/admin
// - Singleton pattern enforcement (single settings row)
// - Provide defaults for missing settings
// ============================================================

const { serviceClient } = require('../config/supabase');
const { NotFoundError } = require('../middleware/errorHandler');

// ============================================================
// Default Settings
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
// Helpers
// ============================================================

function parseBoolean(value, defaultValue) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
    }

    return Boolean(value);
}

function normalizeShippingCountry(row) {
    if (!row) return null;

    return {
        id: row.id,
        country_code: row.country_code,
        country_name: row.country_name,
        shipping_cost: parseFloat(row.shipping_cost || 0),
        estimated_days_min: Number(row.estimated_days_min || 0),
        estimated_days_max: Number(row.estimated_days_max || 0),
        active: Boolean(row.active),
        sort_order: Number(row.sort_order || 0),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function getShippingCountryById(id) {
    const { data, error } = await serviceClient
        .from('shipping_countries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching shipping country:', error);
        throw error;
    }

    if (!data) {
        throw new NotFoundError('Shipping country not found.');
    }

    return data;
}

// ============================================================
// Get Settings
// ============================================================

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

    if (createIfMissing) {
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

    return DEFAULT_SETTINGS;
}

// ============================================================
// Shipping Countries
// ============================================================

async function getShippingCountries(includeInactive = false) {
    let query = serviceClient
        .from('shipping_countries')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('country_name', { ascending: true });

    if (!includeInactive) {
        query = query.eq('active', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching shipping countries:', error);
        return [];
    }

    return (data || []).map(normalizeShippingCountry);
}

async function createShippingCountry(countryData) {
    const countryCode = String(countryData.country_code || '').trim().toUpperCase();
    const countryName = String(countryData.country_name || '').trim();

    if (!countryCode) {
        throw new Error('Country code is required.');
    }

    if (!countryName) {
        throw new Error('Country name is required.');
    }

    const payload = {
        country_code: countryCode,
        country_name: countryName,
        shipping_cost: parseFloat(countryData.shipping_cost || 0),
        estimated_days_min: Number.parseInt(countryData.estimated_days_min, 10) || 0,
        estimated_days_max: Number.parseInt(countryData.estimated_days_max, 10) || 0,
        active: parseBoolean(countryData.active, true),
        sort_order: Number.parseInt(countryData.sort_order, 10) || 0,
        updated_at: new Date().toISOString(),
    };

    if (payload.estimated_days_max < payload.estimated_days_min) {
        payload.estimated_days_max = payload.estimated_days_min;
    }

    const { data, error } = await serviceClient
        .from('shipping_countries')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('Error creating shipping country:', error);
        throw error;
    }

    return normalizeShippingCountry(data);
}

async function updateShippingCountry(id, countryData) {
    await getShippingCountryById(id);

    const updates = {};

    if (countryData.country_code !== undefined) {
        const code = String(countryData.country_code || '').trim().toUpperCase();
        if (!code) throw new Error('Country code is required.');
        updates.country_code = code;
    }

    if (countryData.country_name !== undefined) {
        const name = String(countryData.country_name || '').trim();
        if (!name) throw new Error('Country name is required.');
        updates.country_name = name;
    }

    if (countryData.shipping_cost !== undefined) {
        updates.shipping_cost = parseFloat(countryData.shipping_cost || 0);
    }

    if (countryData.estimated_days_min !== undefined) {
        updates.estimated_days_min = Number.parseInt(countryData.estimated_days_min, 10) || 0;
    }

    if (countryData.estimated_days_max !== undefined) {
        updates.estimated_days_max = Number.parseInt(countryData.estimated_days_max, 10) || 0;
    }

    if (countryData.active !== undefined) {
        updates.active = parseBoolean(countryData.active, true);
    }

    if (countryData.sort_order !== undefined) {
        updates.sort_order = Number.parseInt(countryData.sort_order, 10) || 0;
    }

    if (updates.estimated_days_min !== undefined && updates.estimated_days_max !== undefined) {
        if (updates.estimated_days_max < updates.estimated_days_min) {
            updates.estimated_days_max = updates.estimated_days_min;
        }
    }

    if (Object.keys(updates).length === 0) {
        const current = await getShippingCountryById(id);
        return normalizeShippingCountry(current);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await serviceClient
        .from('shipping_countries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating shipping country:', error);
        throw error;
    }

    return normalizeShippingCountry(data);
}

async function deleteShippingCountry(id) {
    const current = await getShippingCountryById(id);

    const { error } = await serviceClient
        .from('shipping_countries')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting shipping country:', error);
        throw error;
    }

    return normalizeShippingCountry(current);
}

// ============================================================
// Update Settings
// ============================================================

async function updateSettings(settingsData) {
    let currentSettings = await getSettings(true);

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

    if (Object.keys(updates).length === 0) {
        return currentSettings;
    }

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

async function getPublicShippingCountries() {
    return getShippingCountries(false);
}

// ============================================================
// Specific Settings Helpers
// ============================================================

async function getShippingCost() {
    const settings = await getSettings(false);
    return parseFloat(settings.shipping_cost || 0);
}

async function getFreeShippingThreshold() {
    const settings = await getSettings(false);
    return settings.free_shipping_threshold
        ? parseFloat(settings.free_shipping_threshold)
        : null;
}

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
    getShippingCountries,
    getPublicShippingCountries,
    createShippingCountry,
    updateShippingCountry,
    deleteShippingCountry,
};
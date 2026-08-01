// ============================================================
// CloudyBreeze E-Commerce System
// Express Application Entry Point
// ============================================================

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

const errorHandler = require('./middleware/errorHandler');

const envFiles = ['.env.example', '.env', '.env.local'];
for (const envFile of envFiles) {
    const envPath = path.join(__dirname, envFile);
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath, override: true });
    }
}

// Route imports
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const contactRoutes = require('./routes/contact');
const newsletterRoutes = require('./routes/newsletter');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');

// ============================================================
// App Initialization
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// Security Middleware
// ============================================================

// Helmet - Security headers
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
                connectSrc: ["'self'", 'https://*.supabase.co'],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

// CORS - Cross-Origin Resource Sharing
app.use(
    cors({
        origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN || '*' : '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    })
);

// ============================================================
// Rate Limiting
// ============================================================

// Global rate limit - 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
        },
    },
});

// Auth rate limit - 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts. Please try again later.',
        },
    },
});

app.use('/api/', globalLimiter);
app.use('/api/admin/auth', authLimiter);

// ============================================================
// Logging
// ============================================================
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ============================================================
// Body Parsing
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// Session Configuration
// ============================================================
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'cloudybreeze-default-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'lax',
        },
    })
);

// ============================================================
// Static File Serving
// ============================================================

// Public frontend
app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// Admin panel - protected at route level, files are publicly accessible
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// ============================================================
// API Routes
// ============================================================

// Public API routes
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/settings', settingsRoutes);

// Admin API routes
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/upload', uploadRoutes);

// ============================================================
// Frontend Page Routes
// ============================================================

// Public pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/products', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'products.html'));
});

app.get('/products/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

app.get('/tracking', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tracking.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/faq', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'faq.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/refund', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'refund.html'));
});

app.get('/shipping', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'shipping.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

// Admin pages
app.get('/admin', (req, res) => {
    res.redirect('/admin/login.html');
});

app.get('/admin/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.get('/admin/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

app.get('/admin/products.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'products.html'));
});

app.get('/admin/product-editor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'product-editor.html'));
});

app.get('/admin/categories.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'categories.html'));
});

app.get('/admin/orders.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'orders.html'));
});

app.get('/admin/analytics.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'analytics.html'));
});

app.get('/admin/settings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'settings.html'));
});

// ============================================================
// 404 Handler
// ============================================================
app.use('/admin', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ============================================================
// Error Handler
// ============================================================
app.use(errorHandler);

// ============================================================
// Server Start
// ============================================================
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  CloudyBreeze E-Commerce Server`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Port: ${PORT}`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`========================================\n`);
});

module.exports = app;
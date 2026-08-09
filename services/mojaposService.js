// ============================================================
// CloudyBreeze - MojaPOS Payment Service
// ============================================================
// Uses MojaPOS Hosted Checkout so MojaPOS can present the payment
// methods enabled for the CloudyBreeze project.
// ============================================================

const { serviceClient } = require('../config/supabase');
const { BadRequestError, NotFoundError } = require('../middleware/errorHandler');

const MOJAPOS_CHECKOUT_URL = 'https://moj
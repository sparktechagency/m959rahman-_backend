const express = require("express");
const router = express.Router();
const StripeWebhookController = require("./stripeWebhook.controller");

/**
 * @route   POST /api/webhook/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public (Stripe only, verified by signature)
 * 
 * IMPORTANT: This route requires raw body parsing
 * It must be registered BEFORE bodyParser.json() middleware
 */
router.post(
    "/stripe",
    express.raw({ type: "application/json" }),
    StripeWebhookController.handleStripeWebhook
);

module.exports = router;

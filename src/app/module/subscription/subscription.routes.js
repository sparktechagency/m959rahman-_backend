const express = require("express");
const router = express.Router();
const SubscriptionController = require("./subscription.controller");
const auth = require("../../middleware/auth");
const { EnumUserRole } = require("../../../util/enum");

// All routes require authentication
router.use(auth(EnumUserRole.TEACHER, EnumUserRole.SCHOOL));

/**
 * @route   POST /api/subscription/create-checkout
 * @desc    Create Stripe Checkout session for subscription
 * @access  Private (Teacher, School)
 * @body    { planId: string }
 */
router.post("/create-checkout", SubscriptionController.createCheckoutSession);

/**
 * @route   POST /api/subscription/cancel
 * @desc    Cancel current subscription
 * @access  Private (Teacher, School)
 */
router.post("/cancel", SubscriptionController.cancelSubscription);

/**
 * @route   GET /api/subscription/status
 * @desc    Get current subscription status and details
 * @access  Private (Teacher, School)
 */
router.get("/status", SubscriptionController.getSubscriptionStatus);

/**
 * @route   GET /api/subscription/plans
 * @desc    Get available subscription plans for user's role
 * @access  Private (Teacher, School)
 */
router.get("/plans", SubscriptionController.getAvailablePlans);

module.exports = router;

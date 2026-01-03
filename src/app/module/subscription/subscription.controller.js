const SubscriptionService = require("./subscription.service");
const sendResponse = require("../../../util/sendResponse");
const { status } = require("http-status");

/**
 * Create a Stripe Checkout session
 * POST /api/subscription/create-checkout
 */
const createCheckoutSession = async (req, res, next) => {
    try {
        const result = await SubscriptionService.createCheckoutSession(
            req.user,
            req.body
        );

        sendResponse(res, {
            statusCode: status.OK,
            success: true,
            message: "Checkout session created successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel subscription
 * POST /api/subscription/cancel
 */
const cancelSubscription = async (req, res, next) => {
    try {
        const result = await SubscriptionService.cancelSubscription(req.user);

        sendResponse(res, {
            statusCode: status.OK,
            success: true,
            message: "Subscription canceled successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get subscription status
 * GET /api/subscription/status
 */
const getSubscriptionStatus = async (req, res, next) => {
    try {
        const result = await SubscriptionService.getSubscriptionStatus(req.user);

        sendResponse(res, {
            statusCode: status.OK,
            success: true,
            message: "Subscription status retrieved successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get available plans
 * GET /api/subscription/plans
 */
const getAvailablePlans = async (req, res, next) => {
    try {
        const result = await SubscriptionService.getAvailablePlans(req.user);

        sendResponse(res, {
            statusCode: status.OK,
            success: true,
            message: "Available plans retrieved successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

const SubscriptionController = {
    createCheckoutSession,
    cancelSubscription,
    getSubscriptionStatus,
    getAvailablePlans,
};

module.exports = SubscriptionController;

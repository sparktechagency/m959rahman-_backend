const stripe = require("../../../util/stripeClient");
const StripeCustomerService = require("../stripe/stripeCustomer.service");
const Teacher = require("../teacher/Teacher");
const School = require("../school/School");
const StripeCustomer = require("../stripe/StripeCustomer");
const { getPlanById, getPlansByRole } = require("../../../config/subscriptionPlans");
const ApiError = require("../../../error/ApiError");
const { status } = require("http-status");
const { logger } = require("../../../util/logger");
const config = require("../../../config");

/**
 * Create a Stripe Checkout session for subscription
 * @param {object} userData - User data with authId, userId, role, email
 * @param {object} payload - Contains planId
 * @returns {Promise<object>} Checkout session with URL
 */
const createCheckoutSession = async (userData, payload) => {
    const { authId, userId, role, email } = userData;
    const { planId } = payload;

    // Validate role
    if (role !== "TEACHER" && role !== "SCHOOL") {
        throw new ApiError(
            status.BAD_REQUEST,
            "Only teachers and schools can subscribe to plans"
        );
    }

    // Get plan configuration
    const plan = getPlanById(planId);
    if (!plan) {
        throw new ApiError(status.BAD_REQUEST, "Invalid plan ID");
    }

    // Verify plan matches role
    if (
        (role === "TEACHER" && planId !== "TEACHER_YEARLY") ||
        (role === "SCHOOL" && planId !== "SCHOOL_YEARLY")
    ) {
        throw new ApiError(
            status.BAD_REQUEST,
            `Plan ${planId} is not available for ${role} role`
        );
    }

    try {
        // Get user model
        const UserModel = role === "TEACHER" ? Teacher : School;
        const user = await UserModel.findById(userId);

        if (!user) {
            throw new ApiError(status.NOT_FOUND, `${role} not found`);
        }

        // Check if already has active subscription
        if (user.subscription?.status === "active") {
            throw new ApiError(
                status.BAD_REQUEST,
                "You already have an active subscription"
            );
        }

        // Get or create Stripe customer
        const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || email;
        const { customerId } = await StripeCustomerService.getOrCreateStripeCustomer(
            { authId, email, role },
            userName
        );

        // Create Stripe Price if not exists (for first-time setup)
        let priceId = plan.stripePriceId;

        if (!priceId) {
            // Create product
            const product = await stripe.products.create({
                name: plan.name,
                description: plan.description,
                metadata: {
                    planId: plan.id,
                    role: role,
                },
            });

            // Create price
            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: plan.price,
                currency: plan.currency,
                recurring: {
                    interval: plan.interval,
                },
                metadata: {
                    planId: plan.id,
                },
            });

            priceId = price.id;
            logger.info(`Created Stripe price ${priceId} for plan ${plan.id}`);
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${config.frontend_url}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.frontend_url}/subscription/cancel`,
            metadata: {
                authId: authId.toString(),
                userId: userId.toString(),
                role: role,
                planId: plan.id,
            },
            subscription_data: {
                metadata: {
                    authId: authId.toString(),
                    userId: userId.toString(),
                    role: role,
                    planId: plan.id,
                },
            },
        });

        logger.info(`Created checkout session ${session.id} for user ${userId}`);

        return {
            sessionId: session.id,
            checkoutUrl: session.url,
            planName: plan.name,
            price: plan.price,
            currency: plan.currency,
        };
    } catch (error) {
        logger.error("Error creating checkout session:", error);

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(
            status.INTERNAL_SERVER_ERROR,
            error.message || "Failed to create checkout session"
        );
    }
};

/**
 * Cancel a subscription
 * @param {object} userData - User data
 * @returns {Promise<object>} Cancellation confirmation
 */
const cancelSubscription = async (userData) => {
    const { userId, role } = userData;

    if (role !== "TEACHER" && role !== "SCHOOL") {
        throw new ApiError(status.BAD_REQUEST, "Invalid role for subscription");
    }

    try {
        const UserModel = role === "TEACHER" ? Teacher : School;
        const user = await UserModel.findById(userId);

        if (!user) {
            throw new ApiError(status.NOT_FOUND, `${role} not found`);
        }

        if (!user.subscription?.stripeSubscriptionId) {
            throw new ApiError(status.BAD_REQUEST, "No active subscription found");
        }

        // Cancel subscription at period end (don't cancel immediately)
        const subscription = await stripe.subscriptions.update(
            user.subscription.stripeSubscriptionId,
            {
                cancel_at_period_end: true,
            }
        );

        // Update user record
        user.subscription.cancelAtPeriodEnd = true;
        user.subscription.canceledAt = new Date();
        await user.save();

        logger.info(`Canceled subscription ${subscription.id} for user ${userId}`);

        return {
            message: "Subscription will be canceled at the end of the billing period",
            cancelAt: subscription.current_period_end,
            accessUntil: new Date(subscription.current_period_end * 1000),
        };
    } catch (error) {
        logger.error("Error canceling subscription:", error);

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(
            status.INTERNAL_SERVER_ERROR,
            "Failed to cancel subscription"
        );
    }
};

/**
 * Get subscription status and details
 * @param {object} userData - User data
 * @returns {Promise<object>} Subscription details
 */
const getSubscriptionStatus = async (userData) => {
    const { userId, role } = userData;

    if (role !== "TEACHER" && role !== "SCHOOL") {
        throw new ApiError(status.BAD_REQUEST, "Invalid role for subscription");
    }

    try {
        const UserModel = role === "TEACHER" ? Teacher : School;
        const user = await UserModel.findById(userId);

        if (!user) {
            throw new ApiError(status.NOT_FOUND, `${role} not found`);
        }

        const subscription = user.subscription;

        // Get plan details
        const plan = getPlanById(subscription?.plan);

        // Calculate usage if active subscription
        let usage = null;
        if (subscription?.status === "active" && plan) {
            // This will be implemented based on actual usage tracking
            usage = {
                limits: plan.limits,
                current: {
                    // These will be filled in later with actual counts
                    classes: 0,
                    students: 0,
                    ...(role === "SCHOOL" && { teachers: 0 }),
                },
            };
        }

        return {
            status: subscription?.status || "inactive",
            plan: subscription?.plan || null,
            planName: plan?.name || null,
            currentPeriodStart: subscription?.currentPeriodStart || null,
            currentPeriodEnd: subscription?.currentPeriodEnd || null,
            cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
            canceledAt: subscription?.canceledAt || null,
            stripeSubscriptionId: subscription?.stripeSubscriptionId || null,
            usage,
        };
    } catch (error) {
        logger.error("Error getting subscription status:", error);

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(
            status.INTERNAL_SERVER_ERROR,
            "Failed to get subscription status"
        );
    }
};

/**
 * Get available subscription plans for user's role
 * @param {object} userData - User data
 * @returns {Promise<array>} Available plans
 */
const getAvailablePlans = async (userData) => {
    const { role } = userData;

    const plans = getPlansByRole(role);

    return plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features,
        limits: plan.limits,
    }));
};

const SubscriptionService = {
    createCheckoutSession,
    cancelSubscription,
    getSubscriptionStatus,
    getAvailablePlans,
};

module.exports = SubscriptionService;

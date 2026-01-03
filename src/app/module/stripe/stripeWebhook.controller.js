const stripe = require("../../../util/stripeClient");
const Teacher = require("../teacher/Teacher");
const School = require("../school/School");
const StripeCustomer = require("./StripeCustomer");
const config = require("../../../config");
const { logger } = require("../../../util/logger");

/**
 * Handle Stripe webhook events
 * POST /webhook/stripe
 */
const handleStripeWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = config.stripe.stripe_webhook_secret;

    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        logger.info(`✅ Webhook received: ${event.type} - ${event.id}`);
    } catch (err) {
        logger.error(`❌ Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        logger.info(`Processing event: ${event.type}`);

        switch (event.type) {
            case "checkout.session.completed":
                await handleCheckoutCompleted(event.data.object);
                break;

            case "customer.subscription.created":
                logger.info(`Subscription created: ${event.data.object.id}`);
                await handleCheckoutCompleted(event.data.object);
                break;

            case "customer.subscription.updated":
                await handleSubscriptionUpdated(event.data.object);
                break;

            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event.data.object);
                break;

            case "invoice.payment_succeeded":
                await handlePaymentSucceeded(event.data.object);
                break;

            case "invoice.payment_failed":
                await handlePaymentFailed(event.data.object);
                break;

            default:
                logger.info(`⚠️ Unhandled event type: ${event.type}`);
        }

        logger.info(`✅ Event ${event.type} processed successfully`);
        res.json({ received: true });
    } catch (error) {
        logger.error(`❌ Error handling webhook event ${event.type}:`, error);
        logger.error(`Error stack:`, error.stack);
        res.status(500).json({ error: "Webhook handler failed", details: error.message });
    }
};

/**
 * Handle successful checkout session completion
 */
const handleCheckoutCompleted = async (session) => {
    logger.info(`📋 Processing checkout.session.completed: ${session.id}`);
    logger.info(`Session metadata:`, JSON.stringify(session.metadata));

    const { userId, role, planId } = session.metadata;

    if (!userId || !role || !planId) {
        logger.error(`❌ Missing metadata in session ${session.id}: userId=${userId}, role=${role}, planId=${planId}`);
        return;
    }

    try {
        // Get the subscription from the session
        logger.info(`Retrieving subscription from session: ${session.subscription}`);
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription
        );
        logger.info(`✅ Retrieved subscription: ${subscription.id}, status: ${subscription.status}`);

        // Update user's subscription details
        const UserModel = role === "TEACHER" ? Teacher : School;
        logger.info(`Looking for user: ${userId} with role: ${role}`);
        const user = await UserModel.findById(userId);

        if (!user) {
            logger.error(`❌ User not found: ${userId} with role ${role}`);
            return;
        }

        logger.info(`✅ Found user: ${user._id}, current subscription status: ${user.subscription?.status || 'none'}`);

        // Store previous state for logging
        const previousStatus = user.subscription?.status;

        user.subscription = {
            ...user.subscription,
            plan: planId,
            status: subscription.status,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer,
            stripePriceId: subscription.items.data[0].price.id,
            stripeProductId: subscription.items.data[0].price.product,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            startDate: new Date(subscription.current_period_start * 1000),
            endDate: new Date(subscription.current_period_end * 1000),
            renewalDate: new Date(subscription.current_period_end * 1000),
            autoRenew: !subscription.cancel_at_period_end,
        };

        logger.info(`Saving user with subscription update: ${previousStatus} -> ${subscription.status}`);
        await user.save();
        logger.info(`✅ User saved successfully with new subscription`);

        // Update StripeCustomer record
        logger.info(`Updating StripeCustomer record for customer: ${subscription.customer}`);
        await StripeCustomer.findOneAndUpdate(
            { stripeCustomerId: subscription.customer },
            {
                currentSubscriptionId: subscription.id,
                $push: {
                    subscriptionHistory: {
                        subscriptionId: subscription.id,
                        planId: planId,
                        status: subscription.status,
                        startDate: new Date(subscription.current_period_start * 1000),
                        endDate: new Date(subscription.current_period_end * 1000),
                    },
                },
            }
        );

        logger.info(`🎉 Subscription activated successfully for user ${userId}!`);
    } catch (error) {
        logger.error(`❌ Error in handleCheckoutCompleted:`, error);
        logger.error(`Error stack:`, error.stack);
        throw error;
    }
};

/**
 * Handle subscription updates
 */
const handleSubscriptionUpdated = async (subscription) => {
    logger.info(`📋 Processing customer.subscription.updated: ${subscription.id}`);

    const { userId, role } = subscription.metadata;

    if (!userId || !role) {
        logger.warn(`⚠️ Missing metadata in subscription ${subscription.id}`);
        return;
    }

    const UserModel = role === "TEACHER" ? Teacher : School;
    const user = await UserModel.findOne({
        "subscription.stripeSubscriptionId": subscription.id,
    });

    if (!user) {
        logger.error(`❌ User not found for subscription ${subscription.id}`);
        return;
    }

    logger.info(`Updating subscription for user ${userId}, status: ${subscription.status}`);

    // Update subscription details
    user.subscription.status = subscription.status;
    user.subscription.currentPeriodStart = new Date(
        subscription.current_period_start * 1000
    );
    user.subscription.currentPeriodEnd = new Date(
        subscription.current_period_end * 1000
    );
    user.subscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    user.subscription.endDate = new Date(subscription.current_period_end * 1000);
    user.subscription.autoRenew = !subscription.cancel_at_period_end;

    if (subscription.canceled_at) {
        user.subscription.canceledAt = new Date(subscription.canceled_at * 1000);
    }

    await user.save();

    logger.info(`✅ Subscription updated for user ${userId}`);
};

/**
 * Handle subscription deletion/cancellation
 */
const handleSubscriptionDeleted = async (subscription) => {
    logger.info(`📋 Processing customer.subscription.deleted: ${subscription.id}`);

    const { userId, role } = subscription.metadata;

    if (!userId || !role) {
        logger.warn(`⚠️ Missing metadata in subscription ${subscription.id}`);
        return;
    }

    const UserModel = role === "TEACHER" ? Teacher : School;
    const user = await UserModel.findOne({
        "subscription.stripeSubscriptionId": subscription.id,
    });

    if (!user) {
        logger.error(`❌ User not found for subscription ${subscription.id}`);
        return;
    }

    // Mark subscription as cancelled
    user.subscription.status = "cancelled";
    user.subscription.canceledAt = new Date();

    await user.save();

    logger.info(`✅ Subscription cancelled for user ${userId}`);
};

/**
 * Handle successful payment
 */
const handlePaymentSucceeded = async (invoice) => {
    logger.info(`📋 Processing invoice.payment_succeeded: ${invoice.id}`);

    if (!invoice.subscription) {
        return;
    }

    const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription
    );
    const { userId, role } = subscription.metadata;

    if (!userId || !role) {
        return;
    }

    const UserModel = role === "TEACHER" ? Teacher : School;
    const user = await UserModel.findOne({
        "subscription.stripeSubscriptionId": subscription.id,
    });

    if (!user) {
        return;
    }

    // Ensure status is active
    user.subscription.status = "active";
    user.subscription.currentPeriodStart = new Date(
        subscription.current_period_start * 1000
    );
    user.subscription.currentPeriodEnd = new Date(
        subscription.current_period_end * 1000
    );

    await user.save();

    logger.info(`✅ Payment succeeded for user ${userId}`);
};

/**
 * Handle failed payment
 */
const handlePaymentFailed = async (invoice) => {
    logger.info(`📋 Processing invoice.payment_failed: ${invoice.id}`);

    if (!invoice.subscription) {
        return;
    }

    const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription
    );
    const { userId, role } = subscription.metadata;

    if (!userId || !role) {
        return;
    }

    const UserModel = role === "TEACHER" ? Teacher : School;
    const user = await UserModel.findOne({
        "subscription.stripeSubscriptionId": subscription.id,
    });

    if (!user) {
        return;
    }

    // Mark as past_due
    user.subscription.status = "past_due";
    await user.save();

    logger.warn(`⚠️ Payment failed for user ${userId}`);

    // TODO: Send email notification to user about failed payment
};

const StripeWebhookController = {
    handleStripeWebhook,
};

module.exports = StripeWebhookController;

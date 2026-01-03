const stripe = require("../../../util/stripeClient");
const StripeCustomer = require("./StripeCustomer");
const ApiError = require("../../../error/ApiError");
const { status } = require("http-status");
const { logger } = require("../../../util/logger");

/**
 * Create or retrieve a Stripe customer for a user
 * @param {object} userData - User data with authId, email, role
 * @param {string} name - Customer name
 * @returns {Promise<object>} Stripe customer object with customer ID
 */
const getOrCreateStripeCustomer = async (userData, name) => {
    const { authId, email, role } = userData;

    try {
        // Check if customer already exists in our database
        let stripeCustomerRecord = await StripeCustomer.findOne({ authId });

        if (stripeCustomerRecord) {
            // Verify customer still exists in Stripe
            try {
                const stripeCustomer = await stripe.customers.retrieve(
                    stripeCustomerRecord.stripeCustomerId
                );

                if (stripeCustomer.deleted) {
                    // Customer was deleted, create a new one
                    throw new Error("Customer deleted in Stripe");
                }

                return {
                    customerId: stripeCustomerRecord.stripeCustomerId,
                    isNew: false,
                };
            } catch (error) {
                // Customer doesn't exist in Stripe, create new one
                logger.warn(
                    `Stripe customer ${stripeCustomerRecord.stripeCustomerId} not found, creating new one`
                );
            }
        }

        // Create new Stripe customer
        const stripeCustomer = await stripe.customers.create({
            email,
            name,
            metadata: {
                authId: authId.toString(),
                role,
            },
        });

        // Save or update customer record in database
        if (stripeCustomerRecord) {
            stripeCustomerRecord.stripeCustomerId = stripeCustomer.id;
            stripeCustomerRecord.email = email;
            await stripeCustomerRecord.save();
        } else {
            stripeCustomerRecord = await StripeCustomer.create({
                authId,
                stripeCustomerId: stripeCustomer.id,
                email,
                role,
            });
        }

        logger.info(`Created Stripe customer ${stripeCustomer.id} for user ${authId}`);

        return {
            customerId: stripeCustomer.id,
            isNew: true,
        };
    } catch (error) {
        logger.error("Error creating Stripe customer:", error);
        throw new ApiError(
            status.INTERNAL_SERVER_ERROR,
            "Failed to create payment customer"
        );
    }
};

/**
 * Retrieve Stripe customer details
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<object>} Stripe customer object
 */
const getStripeCustomer = async (customerId) => {
    try {
        const customer = await stripe.customers.retrieve(customerId);
        return customer;
    } catch (error) {
        logger.error(`Error retrieving Stripe customer ${customerId}:`, error);
        throw new ApiError(status.NOT_FOUND, "Payment customer not found");
    }
};

/**
 * Update customer's default payment method
 * @param {string} customerId - Stripe customer ID
 * @param {string} paymentMethodId - Stripe payment method ID
 * @returns {Promise<object>} Updated customer
 */
const updateDefaultPaymentMethod = async (customerId, paymentMethodId) => {
    try {
        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
        });

        // Set as default payment method
        const customer = await stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Get payment method details for storage
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

        // Update our database record
        await StripeCustomer.findOneAndUpdate(
            { stripeCustomerId: customerId },
            {
                defaultPaymentMethod: paymentMethodId,
                paymentMethodLast4: paymentMethod.card?.last4,
                paymentMethodBrand: paymentMethod.card?.brand,
            }
        );

        logger.info(`Updated payment method for customer ${customerId}`);

        return customer;
    } catch (error) {
        logger.error("Error updating payment method:", error);
        throw new ApiError(
            status.BAD_REQUEST,
            "Failed to update payment method"
        );
    }
};

/**
 * Delete a Stripe customer
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<object>} Deleted customer confirmation
 */
const deleteStripeCustomer = async (customerId) => {
    try {
        const deleted = await stripe.customers.del(customerId);

        // Remove from our database
        await StripeCustomer.findOneAndDelete({ stripeCustomerId: customerId });

        logger.info(`Deleted Stripe customer ${customerId}`);

        return deleted;
    } catch (error) {
        logger.error(`Error deleting Stripe customer ${customerId}:`, error);
        throw new ApiError(
            status.INTERNAL_SERVER_ERROR,
            "Failed to delete payment customer"
        );
    }
};

/**
 * Get customer's payment methods
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<array>} List of payment methods
 */
const getPaymentMethods = async (customerId) => {
    try {
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card",
        });

        return paymentMethods.data;
    } catch (error) {
        logger.error("Error retrieving payment methods:", error);
        throw new ApiError(
            status.INTERNAL_SERVER_ERROR,
            "Failed to retrieve payment methods"
        );
    }
};

const StripeCustomerService = {
    getOrCreateStripeCustomer,
    getStripeCustomer,
    updateDefaultPaymentMethod,
    deleteStripeCustomer,
    getPaymentMethods,
};

module.exports = StripeCustomerService;

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

/**
 * Stripe Customer Schema
 * Maps application users to Stripe customer accounts
 */
const StripeCustomerSchema = new Schema(
    {
        authId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Auth",
            unique: true,
            index: true,
        },
        stripeCustomerId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ["TEACHER", "SCHOOL"],
            required: true,
        },
        // Default payment method ID from Stripe
        defaultPaymentMethod: {
            type: String,
        },
        // Store last 4 digits for display
        paymentMethodLast4: {
            type: String,
        },
        paymentMethodBrand: {
            type: String,
        },
        // Current active subscription
        currentSubscriptionId: {
            type: String,
        },
        // Subscription history for reference
        subscriptionHistory: [
            {
                subscriptionId: String,
                planId: String,
                status: String,
                startDate: Date,
                endDate: Date,
                canceledAt: Date,
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Index for faster lookups
StripeCustomerSchema.index({ stripeCustomerId: 1 });
StripeCustomerSchema.index({ authId: 1 });

const StripeCustomer = model("StripeCustomer", StripeCustomerSchema);

module.exports = StripeCustomer;

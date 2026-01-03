const Stripe = require("stripe");
const config = require("../config");

// Initialize Stripe with secret key
const stripe = new Stripe(config.stripe.stripe_secret_key, {
    apiVersion: "2024-12-18.acacia", // Use latest stable API version
});

module.exports = stripe;

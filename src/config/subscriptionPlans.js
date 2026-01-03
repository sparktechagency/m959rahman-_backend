/**
 * Subscription Plan Configurations
 * Defines pricing, limits, and features for Teacher and School plans
 */

const subscriptionPlans = {
    TEACHER_YEARLY: {
        id: "TEACHER_YEARLY",
        name: "Individual Teacher Plan",
        description: "Perfect for individual teachers managing their classes",
        price: 5000, // £50.00 in pence (Stripe uses smallest currency unit)
        currency: "gbp",
        interval: "year",
        features: [
            "Up to 7 classes",
            "Up to 33 students per class",
            "View all student screens live",
            "Add/remove users easily",
        ],
        limits: {
            classes: 7,
            studentsPerClass: 33,
        },
        // These will be replaced with actual Stripe Price IDs from your dashboard
        stripePriceId: process.env.STRIPE_TEACHER_YEARLY_PRICE_ID || null,
    },

    SCHOOL_YEARLY: {
        id: "SCHOOL_YEARLY",
        name: "School Plan",
        description: "Comprehensive solution for schools with multiple teachers",
        price: 20000, // $200.00 in cents
        currency: "usd",
        interval: "year",
        features: [
            "15 teachers",
            "Up to 33 students per class",
            "Up to 7 classes per teacher",
            "Add/remove users easily",
        ],
        limits: {
            teachers: 15,
            classesPerTeacher: 7,
            studentsPerClass: 33,
        },
        // These will be replaced with actual Stripe Price IDs from your dashboard
        stripePriceId: process.env.STRIPE_SCHOOL_YEARLY_PRICE_ID || null,
    },
};

/**
 * Get plan configuration by ID
 * @param {string} planId - Plan identifier
 * @returns {object|null} Plan configuration or null if not found
 */
const getPlanById = (planId) => {
    return subscriptionPlans[planId] || null;
};

/**
 * Get all plans available for a specific role
 * @param {string} role - User role (TEACHER or SCHOOL)
 * @returns {array} Array of available plans
 */
const getPlansByRole = (role) => {
    if (role === "TEACHER") {
        return [subscriptionPlans.TEACHER_YEARLY];
    }
    if (role === "SCHOOL") {
        return [subscriptionPlans.SCHOOL_YEARLY];
    }
    return [];
};

/**
 * Validate if a user has exceeded their subscription limits
 * @param {object} plan - Plan configuration
 * @param {object} usage - Current usage stats
 * @returns {object} { valid: boolean, exceeded: array of exceeded limits }
 */
const validateLimits = (plan, usage) => {
    const exceeded = [];

    if (plan.limits.classes && usage.classes > plan.limits.classes) {
        exceeded.push({
            limit: "classes",
            allowed: plan.limits.classes,
            current: usage.classes,
        });
    }

    if (
        plan.limits.studentsPerClass &&
        usage.studentsPerClass > plan.limits.studentsPerClass
    ) {
        exceeded.push({
            limit: "studentsPerClass",
            allowed: plan.limits.studentsPerClass,
            current: usage.studentsPerClass,
        });
    }

    if (plan.limits.teachers && usage.teachers > plan.limits.teachers) {
        exceeded.push({
            limit: "teachers",
            allowed: plan.limits.teachers,
            current: usage.teachers,
        });
    }

    return {
        valid: exceeded.length === 0,
        exceeded,
    };
};

module.exports = {
    subscriptionPlans,
    getPlanById,
    getPlansByRole,
    validateLimits,
};

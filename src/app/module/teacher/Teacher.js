const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const TeacherSchema = new Schema(
  {
    authId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Auth",
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      required: true,
    },
    profile_image: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    dateOfBirth: {
      type: String,
    },
    address: {
      type: String,
    },
    bio: {
      type: String,
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    qualifications: [{
      degree: String,
      institution: String,
      year: Number
    }],
    experience: {
      type: Number, // in years
      default: 0,
    },
    subscription: {
      plan: {
        type: String,
        enum: ["basic", "premium", "pro", "TEACHER_YEARLY"],
        default: "basic"
      },
      status: {
        type: String,
        enum: ["active", "inactive", "cancelled", "expired", "past_due", "trialing"],
        default: "inactive"
      },
      // Stripe-specific fields
      stripeSubscriptionId: {
        type: String,
        sparse: true,
      },
      stripeCustomerId: {
        type: String,
        sparse: true,
      },
      stripePriceId: {
        type: String,
      },
      stripeProductId: {
        type: String,
      },
      // Billing period tracking
      currentPeriodStart: {
        type: Date,
      },
      currentPeriodEnd: {
        type: Date,
      },
      cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
      },
      canceledAt: {
        type: Date,
      },
      // Legacy fields (kept for backward compatibility)
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
      renewalDate: {
        type: Date,
      },
      autoRenew: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Teacher = model("Teacher", TeacherSchema);

module.exports = Teacher;
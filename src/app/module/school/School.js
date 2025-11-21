const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const SchoolSchema = new Schema(
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
      default: null,
    },
    cover_image: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
    },
    address: {
      type: String,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    subscription: {
      plan: {
        type: String,
        enum: ["basic", "premium", "pro"],
        default: "basic"
      },
      status: {
        type: String,
        enum: ["active", "inactive", "cancelled", "expired"],
        default: "inactive"
      },
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

const School = model("School", SchoolSchema);

module.exports = School;
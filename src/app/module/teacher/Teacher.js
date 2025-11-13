const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const TeacherSchema = new Schema(
  {
    authId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Auth",
    },
    firstname: {
      type: String,
    },
    lastname: {
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

const Teacher = model("Teacher", TeacherSchema);

module.exports = Teacher;
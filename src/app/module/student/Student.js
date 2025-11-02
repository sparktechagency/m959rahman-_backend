const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const { Schema, model, Types } = mongoose;

const StudentSchema = new Schema(
  {
    authId: {
      type: Types.ObjectId,
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
    phoneNumber: {
      type: String,
    },
    dateOfBirth: {
      type: String,
    },
    address: {
      type: String,
    },
    classCode: {
      type: String,
    },

    // isSubscribed: {
    //   type: Boolean,
    //   default: false,
    // },
    // subscriptionPlan: {
    //   type: ObjectId,
    //   ref: "SubscriptionPlan",
    // },
    // subscriptionStartDate: {
    //   type: Date,
    // },
    // subscriptionEndDate: {
    //   type: Date,
    // },
  },
  {
    timestamps: true,
  }
);

const Student = model("Student", StudentSchema);

module.exports = Student;

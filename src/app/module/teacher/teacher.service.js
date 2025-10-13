const { status } = require("http-status");
const mongoose = require("mongoose");

const ApiError = require("../../../error/ApiError");
const Teacher = require("../teacher/Teacher");
// const SubscriptionPlan = require("../../models/subscription/SubscriptionPlan");
const Auth = require("../auth/Auth");
const validateFields = require("../../../util/validateFields");
const unlinkFile = require("../../../util/unlinkFile");

const getProfile = async (userData) => {
  const { userId, authId } = userData;

  const [auth, teacher] = await Promise.all([
    Auth.findById(authId).lean(),
    Teacher.findById(userId).populate("authId").lean(),
  ]);

  if (!teacher || !auth) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  if (auth.isBlocked) {
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");
  }

  return {
    ...teacher,
    auth: {
      email: auth.email,
      role: auth.role,
      isVerified: auth.isVerified,
    }
  };
};

const updateProfile = async (req) => {
  const { files, body: data } = req;
  const { userId, authId } = req.user;
  const updateData = { ...data };

  const existingTeacher = await Teacher.findById(userId).lean();

  if (files && files.profile_image) {
    updateData.profile_image = files.profile_image[0].path;
    if (existingTeacher.profile_image) {
      unlinkFile(existingTeacher.profile_image);
    }
  }

  // Update auth name if firstname or lastname is provided
  if (data.firstname || data.lastname) {
    const auth = await Auth.findById(authId);
    if (auth) {
      const newName = `${data.firstname || existingTeacher.firstname} ${data.lastname || existingTeacher.lastname}`;
      auth.name = newName.trim();
      await auth.save();
    }
  }

  const teacher = await Teacher.findByIdAndUpdate(
    userId,
    { ...updateData },
    {
      new: true,
      runValidators: true,
    }
  ).populate("authId");

  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found!");
  }

  return teacher;
};

const getSubscription = async (userData) => {
  const { userId } = userData;

  const teacher = await Teacher.findById(userId)
    .select("subscription firstname lastname email")
    .lean();

  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  // Get subscription plan details
  const subscriptionPlan = await SubscriptionPlan.findOne({
    name: teacher.subscription.plan,
    isActive: true,
  }).lean();

  return {
    teacher: {
      name: `${teacher.firstname} ${teacher.lastname}`,
      email: teacher.email,
    },
    subscription: teacher.subscription,
    planDetails: subscriptionPlan,
  };
};

const updateSubscription = async (userData, payload) => {
  validateFields(payload, ["plan", "autoRenew"]);

  const { userId } = userData;
  const { plan, autoRenew } = payload;

  // Validate plan
  const validPlans = ["basic", "premium", "pro"];
  if (!validPlans.includes(plan)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid subscription plan");
  }

  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  // Calculate subscription dates
  const startDate = teacher.subscription.startDate || new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1); // Default 1 month

  const renewalDate = new Date(endDate);

  teacher.subscription = {
    plan,
    status: "active",
    startDate,
    endDate,
    renewalDate,
    autoRenew: autoRenew !== undefined ? autoRenew : teacher.subscription.autoRenew,
  };

  await teacher.save();

  return teacher.subscription;
};

const cancelSubscription = async (userData) => {
  const { userId } = userData;

  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  if (teacher.subscription.status !== "active") {
    throw new ApiError(status.BAD_REQUEST, "No active subscription to cancel");
  }

  teacher.subscription.status = "cancelled";
  teacher.subscription.autoRenew = false;

  await teacher.save();

  return {
    message: "Subscription cancelled successfully",
    subscription: teacher.subscription,
  };
};

const renewSubscription = async (userData, payload) => {
  validateFields(payload, ["plan"]);

  const { userId } = userData;
  const { plan } = payload;

  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  const renewalDate = new Date(endDate);

  teacher.subscription = {
    plan,
    status: "active",
    startDate,
    endDate,
    renewalDate,
    autoRenew: true,
  };

  await teacher.save();

  return {
    message: "Subscription renewed successfully",
    subscription: teacher.subscription,
  };
};

const getSubscriptionPlans = async () => {
  const plans = await SubscriptionPlan.find({ isActive: true }).lean();

  return plans;
};

const TeacherService = {
  getProfile,
  updateProfile,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionPlans,
};

module.exports = { TeacherService };
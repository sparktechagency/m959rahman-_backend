const { TeacherService } = require("./teacher.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const getProfile = catchAsync(async (req, res) => {
  const result = await TeacherService.getProfile(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const updateProfile = catchAsync(async (req, res) => {
  const result = await TeacherService.updateProfile(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const getSubscription = catchAsync(async (req, res) => {
  const result = await TeacherService.getSubscription(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription retrieved successfully",
    data: result,
  });
});

const updateSubscription = catchAsync(async (req, res) => {
  const result = await TeacherService.updateSubscription(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription updated successfully",
    data: result,
  });
});

const cancelSubscription = catchAsync(async (req, res) => {
  const result = await TeacherService.cancelSubscription(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription cancelled successfully",
    data: result,
  });
});

const renewSubscription = catchAsync(async (req, res) => {
  const result = await TeacherService.renewSubscription(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription renewed successfully",
    data: result,
  });
});

const getSubscriptionPlans = catchAsync(async (req, res) => {
  const result = await TeacherService.getSubscriptionPlans();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription plans retrieved successfully",
    data: result,
  });
});

const getAllTeachers = catchAsync(async (req, res) => {
  const result = await TeacherService.getAllTeachers(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Teachers retrieved successfully",
    data: result,
  });
});

const getTeacherById = catchAsync(async (req, res) => {
  const result = await TeacherService.getTeacherById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Teacher retrieved successfully",
    data: result,
  });
});

const TeacherController = {
  getProfile,
  updateProfile,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionPlans,
  getAllTeachers,
  getTeacherById,
};

module.exports = { TeacherController };
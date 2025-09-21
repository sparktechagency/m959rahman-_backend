const sendResponse = require("../../../util/sendResponse");
const { SuperAdminService } = require("./superAdmin.service");
const catchAsync = require("../../../util/catchAsync");

const updateProfile = catchAsync(async (req, res) => {
  const result = await SuperAdminService.updateProfile(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const getProfile = catchAsync(async (req, res) => {
  const result = await SuperAdminService.getProfile(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin retrieved successfully",
    data: result,
  });
});

const deleteMyAccount = catchAsync(async (req, res) => {
  await SuperAdminService.deleteMyAccount(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Account deleted!",
  });
});

const createSuperAdmin = catchAsync(async (req, res) => {
  const result = await SuperAdminService.createSuperAdmin(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Super Admin created successfully",
    data: result,
  });
});

const createInitialSuperAdmin = catchAsync(async (req, res) => {
  const result = await SuperAdminService.createInitialSuperAdmin(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Initial Super Admin created successfully",
    data: result,
  });
});

const getAllSuperAdmins = catchAsync(async (req, res) => {
  const result = await SuperAdminService.getAllSuperAdmins(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Super Admins retrieved successfully",
    data: result,
  });
});

const SuperAdminController = {
  updateProfile,
  getProfile,
  deleteMyAccount,
  createSuperAdmin,
  createInitialSuperAdmin,
  getAllSuperAdmins,
};

module.exports = { SuperAdminController };

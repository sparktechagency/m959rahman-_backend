const AdminService = require("./admin.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const postAdmin = catchAsync(async (req, res) => {
  const result = await AdminService.postAdmin(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin created",
    data: result,
  });
});

const getAdmin = catchAsync(async (req, res) => {
  const result = await AdminService.getAdmin(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin retrieved",
    data: result,
  });
});

const getAllAdmins = catchAsync(async (req, res) => {
  const result = await AdminService.getAllAdmins(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admins retrieved",
    data: result,
  });
});

const updateAdmin = catchAsync(async (req, res) => {
  const result = await AdminService.updateAdmin(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin updated",
    data: result,
  });
});

const deleteAdmin = catchAsync(async (req, res) => {
  const result = await AdminService.deleteAdmin(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin deleted",
    data: result,
  });
});

const getProfileAdmin = catchAsync(async (req, res) => {
  const result = await AdminService.getProfileAdmin(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin retrieved successfully",
    data: result,
  });
});

const updateAdminPassword = catchAsync(async (req, res) => {
  const result = await AdminService.updateAdminPassword(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password updated successfully",
    data: result,
  });
});

const updateProfileImageAdmin = catchAsync(async (req, res) => {
  const result = await AdminService.updateProfileImageAdmin(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile image updated successfully",
    data: result,
  });
});

const blockUnblockAdmin = catchAsync(async (req, res) => {
  const result = await AdminService.blockUnblockAdmin(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin updated successfully",
    data: result,
  });
});

const AdminController = {
  postAdmin,
  getAdmin,
  getAllAdmins,
  updateAdmin,
  deleteAdmin,
  getProfileAdmin,
  updateAdminPassword,
  updateProfileImageAdmin,
  blockUnblockAdmin,
};

module.exports = AdminController;

const { StudentService } = require("./student.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const updateProfile = catchAsync(async (req, res) => {
  const result = await StudentService.updateProfile(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const getProfile = catchAsync(async (req, res) => {
  const result = await StudentService.getProfile(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Student retrieved successfully",
    data: result,
  });
});

const deleteMyAccount = catchAsync(async (req, res) => {
  await StudentService.deleteMyAccount(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Account deleted!",
  });
});

const getStudent = catchAsync(async (req, res) => {
  const result = await StudentService.getStudent(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Student retrieved successfully",
    data: result,
  });
});

const updateBlockUnblockStudent = catchAsync(async (req, res) => {
  const result = await StudentService.updateBlockUnblockStudent(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Student updated successfully",
    data: result,
  });
});

const getAllStudents = catchAsync(async (req, res) => {
  const result = await StudentService.getAllStudents(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Students retrieved successfully",
    data: result,
  });
});

const StudentController = {
  deleteMyAccount,
  getProfile,
  updateProfile,
  getStudent,
  updateBlockUnblockStudent,
  getAllStudents,
};

module.exports = { StudentController };

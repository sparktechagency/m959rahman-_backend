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

// Get all students for admin
const getAllStudentsForAdmin = catchAsync(async (req, res) => {
  const result = await StudentService.getAllStudentsForAdmin(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Students retrieved successfully',
    data: result.students,
    meta: result.meta,
  });
});

// Get single student details for admin
const getStudentDetailsForAdmin = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await StudentService.getStudentDetailsForAdmin(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Student details retrieved successfully',
    data: result,
  });
});

// Get all assignments for the authenticated student
const getMyAssignments = catchAsync(async (req, res) => {
  const result = await StudentService.getMyAssignments(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assignments retrieved successfully",
    data: result.assignments,
    meta: result.meta,
  });
});

// Get single assignment details for student
const getAssignmentDetails = catchAsync(async (req, res) => {
  const result = await StudentService.getAssignmentDetails(req.user, req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Assignment details retrieved successfully",
    data: result,
  });
});

const StudentController = {
  updateProfile,
  getProfile,
  deleteMyAccount,
  getStudent,
  updateBlockUnblockStudent,
  getAllStudents,
  getAllStudentsForAdmin,
  getStudentDetailsForAdmin,
  getMyAssignments,
  getAssignmentDetails,
};

module.exports = { StudentController };

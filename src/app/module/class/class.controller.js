const ClassService = require("./class.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const createClass = catchAsync(async (req, res) => {
    const result = await ClassService.createClass(req);
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Class created successfully",
        data: result,
    });
});

const getMyClasses = catchAsync(async (req, res) => {
    const result = await ClassService.getMyClasses(req.user, req.query);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Classes retrieved successfully",
        data: result,
    });
});

const getClassById = catchAsync(async (req, res) => {
    const result = await ClassService.getClassById(req.params.id);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Class retrieved successfully",
        data: result,
    });
});

const updateClass = catchAsync(async (req, res) => {
    const result = await ClassService.updateClass(req.params.id, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Class updated successfully",
        data: result,
    });
});

const deleteClass = catchAsync(async (req, res) => {
    await ClassService.deleteClass(req.params.id);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Class deleted successfully",
    });
});

const addStudentToClass = catchAsync(async (req, res) => {
    const result = await ClassService.addStudentToClass(req.params.id, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Student added to class successfully",
        data: result,
    });
});

const removeStudentFromClass = catchAsync(async (req, res) => {
    const result = await ClassService.removeStudentFromClass(req.params.id, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Student removed from class successfully",
        data: result,
    });
});

const getStudentsInClass = catchAsync(async (req, res) => {
    const result = await ClassService.getStudentsInClass(req.params.id);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Students retrieved successfully",
        data: result,
    });
});

const addAssignmentToClass = catchAsync(async (req, res) => {
    const result = await ClassService.addAssignmentToClass(req.params.classId, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Assignment added to class successfully",
        data: result,
    });
});

const assignAssignmentToStudents = catchAsync(async (req, res) => {
    const result = await ClassService.assignAssignmentToStudents(req.params.classId, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: result.message,
        data: result,
    });
});

const getStudentsOfAssignment = catchAsync(async (req, res) => {
    const result = await ClassService.getStudentsOfAssignment(req.params.classId, req.params.assignmentId);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Students retrieved successfully",
        data: result,
    });
});

const getStudentAssignmentsInClass = catchAsync(async (req, res) => {
    const result = await ClassService.getStudentAssignmentsInClass(req.params.classId, req.params.studentId);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Student assignments retrieved successfully",
        data: result,
    });
});

const getStudentAssignmentSubmission = catchAsync(async (req, res) => {
    const result = await ClassService.getStudentAssignmentSubmission(
        req.params.classId, 
        req.params.studentId, 
        req.params.assignmentId
    );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Student assignment submission retrieved successfully",
        data: result,
    });
});

const removeAssignmentFromStudent = catchAsync(async (req, res) => {
    const result = await ClassService.removeAssignmentFromStudent(
        req.params.classId, 
        req.params.studentId, 
        req.body
    );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: result.message,
        data: result,
    });
});

const removeAssignmentFromClass = catchAsync(async (req, res) => {
    const result = await ClassService.removeAssignmentFromClass(req.params.classId, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Assignment removed from class successfully",
        data: result,
    });
});

const getClassAssignments = catchAsync(async (req, res) => {
    const result = await ClassService.getClassAssignments(req.params.classId);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Class assignments retrieved successfully",
        data: result,
    });
});

const getAssignmentDetails = catchAsync(async (req, res) => {
    const result = await ClassService.getAssignmentDetails(req.params.classId, req.params.assignmentId);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Assignment details retrieved successfully",
        data: result,
    });
});

const getAllAssignmentsByTeacherId = catchAsync(async (req, res) => {
    const result = await ClassService.getAllAssignmentsByTeacherId(req.user.authId);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Assignments retrieved successfully",
        data: result,
    });
});


// ------------------------------------------------------------------
const createAssignment = catchAsync(async (req, res) => {
    const result = await ClassService.createAssignment(req);
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Assignment created successfully",
        data: result,
    });
});

const getQuestionsByCurriculumAndTopic = catchAsync(async (req, res) => {
    const result = await ClassService.getQuestionsByCurriculumAndTopic(req.query);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Questions retrieved successfully",
        data: result,
    });
});

const getAssignmentById = catchAsync(async (req, res) => {
    const result = await ClassService.getAssignmentById(req.params.id);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Assignment retrieved successfully",
        data: result,
    });
});

const getMyAssignments = catchAsync(async (req, res) => {
    const result = await ClassService.getMyAssignments(req.user, req.query);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Assignments retrieved successfully",
        data: result,
    });
});

const updateAssignment = catchAsync(async (req, res) => {
    const result = await ClassService.updateAssignment(req.params.id, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Assignment updated successfully",
        data: result,
    });
});

const deleteAssignment = catchAsync(async (req, res) => {
    await ClassService.deleteAssignment(req.params.id);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Assignment deleted successfully",
    });
});

const addQuestionsToAssignment = catchAsync(async (req, res) => {
    const result = await ClassService.addQuestionsToAssignment(req.params.assignmentId, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Questions added to assignment successfully",
        data: result,
    });
});

const removeQuestionsFromAssignment = catchAsync(async (req, res) => {
    const result = await ClassService.removeQuestionsFromAssignment(req.params.assignmentId, req.body);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Questions removed from assignment successfully",
        data: result,
    });
});


const ClassController = {
    createClass,
    getMyClasses,
    getClassById,
    updateClass,
    deleteClass,
    addStudentToClass,
    removeStudentFromClass,
    getStudentsInClass,
    addAssignmentToClass,
    assignAssignmentToStudents,
    removeAssignmentFromClass,
    getClassAssignments,
    getAssignmentDetails,
    getAllAssignmentsByTeacherId,
    //   ------------------------------
    createAssignment,
    getQuestionsByCurriculumAndTopic,
    getAssignmentById,
    getMyAssignments,
    updateAssignment,
    deleteAssignment,
    addQuestionsToAssignment,
    removeQuestionsFromAssignment,
    getStudentsOfAssignment,
    getStudentAssignmentsInClass,
    getStudentAssignmentSubmission,
    removeAssignmentFromStudent
};

module.exports = { ClassController };
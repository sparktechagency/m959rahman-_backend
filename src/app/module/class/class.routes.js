const express = require("express");
const auth = require("../../middleware/auth");
const { ClassController } = require("./class.controller");
const config = require("../../../config");

const router = express.Router();

// Class routes
router
    .post("/", auth(config.auth_level.teacher), ClassController.createClass)
    .get("/my-classes", auth(config.auth_level.teacher), ClassController.getMyClasses)

// Class specific routes
router
    .get("/:id", auth(config.auth_level.teacher), ClassController.getClassById)
    .patch("/:id", auth(config.auth_level.teacher), ClassController.updateClass)
    .delete("/:id", auth(config.auth_level.teacher), ClassController.deleteClass)
    .post("/:id/students", auth(config.auth_level.teacher), ClassController.addStudentToClass)
    .delete("/:id/remove-student", auth(config.auth_level.teacher), ClassController.removeStudentFromClass)
    .get("/:id/students", auth(config.auth_level.teacher), ClassController.getStudentsInClass);

// Assignment routes within class
router
    .post("/assignments", auth(config.auth_level.teacher), ClassController.createAssignment)
    .get("/:classId/assignments", auth(config.auth_level.teacher), ClassController.getClassAssignments)
    .get("/:classId/assignments/students", auth(config.auth_level.teacher), ClassController.getStudentsOfAssignment)
    .get("/:classId/assignments/:assignmentId", auth(config.auth_level.teacher), ClassController.getAssignmentDetails)
    .delete("/:classId/assignments", auth(config.auth_level.teacher), ClassController.removeAssignmentFromClass)
    .post("/:classId/assignments", auth(config.auth_level.teacher), ClassController.addAssignmentToClass)
    .post("/:classId/assignments/assign-students", auth(config.auth_level.teacher), ClassController.assignAssignmentToStudents)
    // Student assignment routes for teachers
    .get("/:classId/students/:studentId/assignments", auth(config.auth_level.teacher), ClassController.getStudentAssignmentsInClass)
    .get("/:classId/students/:studentId/assignments/:assignmentId", auth(config.auth_level.teacher), ClassController.getStudentAssignmentSubmission)
    .delete("/:classId/students/:studentId/assignments", auth(config.auth_level.teacher), ClassController.removeAssignmentFromStudent)

// General assignment routes (for teacher's all assignments)
router
    .post("/assignments/:assignmentId/questions", auth(config.auth_level.teacher), ClassController.addQuestionsToAssignment)
    .get("/assignments/questions", auth(config.auth_level.user), ClassController.getQuestionsByCurriculumAndTopic)
    .delete("/assignments/:assignmentId/questions", auth(config.auth_level.teacher), ClassController.removeQuestionsFromAssignment)    
    .get("/assignments/my-assignments", auth(config.auth_level.teacher), ClassController.getMyAssignments)
    .get("/assignments/:id", auth(config.auth_level.teacher), ClassController.getAssignmentById)
    .patch("/assignments/:id", auth(config.auth_level.teacher), ClassController.updateAssignment)
    .delete("/assignments/:id", auth(config.auth_level.teacher), ClassController.deleteAssignment);

module.exports = router;
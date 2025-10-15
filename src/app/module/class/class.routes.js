const express = require("express");
const auth = require("../../middleware/auth");
const { ClassController } = require("./class.controller");
const config = require("../../../config");

const router = express.Router();

// Class routes
router
    .post("/", auth(config.auth_level.teacher), ClassController.createClass)
    .get("/my-classes", auth(config.auth_level.teacher), ClassController.getMyClasses)
    .get("/:id", auth(config.auth_level.teacher), ClassController.getClassById)
    .patch("/:id", auth(config.auth_level.teacher), ClassController.updateClass)
    .delete("/:id", auth(config.auth_level.teacher), ClassController.deleteClass)
    .post("/:id/students", auth(config.auth_level.teacher), ClassController.addStudentToClass)
    .delete("/:id/students", auth(config.auth_level.teacher), ClassController.removeStudentFromClass)
    .get("/:id/students", auth(config.auth_level.teacher), ClassController.getStudentsInClass);

// Assignment routes within class
router
    .post("/:classId/assignments", auth(config.auth_level.teacher), ClassController.createAssignment)
    .get("/:classId/assignments", auth(config.auth_level.teacher), ClassController.getClassAssignments)
    .get("/:classId/assignments/:assignmentId", auth(config.auth_level.teacher), ClassController.getAssignmentDetails)
    .delete("/:classId/assignments", auth(config.auth_level.teacher), ClassController.removeAssignmentFromClass)
    .post("/:classId/assignments/:assignmentId/questions", auth(config.auth_level.teacher), ClassController.addQuestionsToAssignment)
    .delete("/:classId/assignments/:assignmentId/questions", auth(config.auth_level.teacher), ClassController.removeQuestionsFromAssignment);

// General assignment routes (for teacher's all assignments)
router
    .get("/assignments/questions", auth(config.auth_level.teacher), ClassController.getQuestionsByCurriculumAndTopic)
    .get("/assignments/my-assignments", auth(config.auth_level.teacher), ClassController.getMyAssignments)
    .get("/assignments/:id", auth(config.auth_level.teacher), ClassController.getAssignmentById)
    .patch("/assignments/:id", auth(config.auth_level.teacher), ClassController.updateAssignment)
    .delete("/assignments/:id", auth(config.auth_level.teacher), ClassController.deleteAssignment);

module.exports = router;
const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { StudentController } = require("./student.controller");
const config = require("../../../config");

const router = express.Router();



// Admin routes for managing students
router.get(
  '/admin/students',
  auth(config.auth_level.admin),
  StudentController.getAllStudentsForAdmin
);

router.get(
  '/admin/students/:id',
  auth(config.auth_level.admin),
  StudentController.getStudentDetailsForAdmin
);




router
  .get("/profile", auth(config.auth_level.student), StudentController.getProfile)
  .patch(
    "/edit-profile",
    auth(config.auth_level.student),
    uploadFile("profile_image" ),
    StudentController.updateProfile
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.student),
    StudentController.deleteMyAccount
  )
  .get("/get-student", auth(config.auth_level.admin), StudentController.getStudent)
  .get(
    "/get-all-students",
    auth(config.auth_level.admin),
    StudentController.getAllStudents
  )
  .post("/join", auth(config.auth_level.student), StudentController.joinClassByCode)
  .patch(
    "/update-block-unblock-student",
    auth(config.auth_level.admin),
    StudentController.updateBlockUnblockStudent
  );

// Student assignment routes
router
  .get("/my-assignments", auth(config.auth_level.student), StudentController.getMyAssignments)
  .get("/assignments/:id", auth(config.auth_level.student), StudentController.getAssignmentDetails);

module.exports = router;

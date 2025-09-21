const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { StudentController } = require("./student.controller");
const config = require("../../../config");

const router = express.Router();

router
  .get("/profile", auth(config.auth_level.student), StudentController.getProfile)
  .patch(
    "/edit-profile",
    auth(config.auth_level.student),
    uploadFile(),
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
  .patch(
    "/update-block-unblock-student",
    auth(config.auth_level.admin),
    StudentController.updateBlockUnblockStudent
  );

module.exports = router;

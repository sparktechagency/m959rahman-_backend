const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { TeacherController } = require("./teacher.controller");
const config = require("../../../config");

const router = express.Router();

router
  .get("/profile", auth(config.auth_level.teacher), TeacherController.getProfile)
  .patch(
    "/profile",
    auth(config.auth_level.teacher),
    uploadFile([{ name: "profile_image", maxCount: 1 }]),
    TeacherController.updateProfile
  )
  .get("/students", auth(config.auth_level.teacher), TeacherController.getAllStudentsForTeacher) 
  .get("/all", auth(config.auth_level.admin), TeacherController.getAllTeachers)
  .get("/:id", auth(config.auth_level.admin), TeacherController.getTeacherById)
  .patch("/:id", auth(config.auth_level.admin), TeacherController.blockUnblockTeacher)
//   .get("/subscription", auth(config.auth_level.teacher), TeacherController.getSubscription)
//   .patch("/subscription", auth(config.auth_level.teacher), TeacherController.updateSubscription)
//   .post("/subscription/cancel", auth(config.auth_level.teacher), TeacherController.cancelSubscription)
//   .post("/subscription/renew", auth(config.auth_level.teacher), TeacherController.renewSubscription)
//   .get("/subscription/plans", auth(config.auth_level.teacher), TeacherController.getSubscriptionPlans);

module.exports = router;
const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { UserController } = require("./user.controller");
const config = require("../../../config");

const router = express.Router();

router
  .get("/profile", auth(config.auth_level.user), UserController.getProfile)
  .patch(
    "/edit-profile",
    auth(config.auth_level.user),
    uploadFile(),
    UserController.updateProfile
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.user),
    UserController.deleteMyAccount
  )
  .get("/get-user", auth(config.auth_level.admin), UserController.getUser)
  .get(
    "/get-all-users",
    auth(config.auth_level.admin),
    UserController.getAllUsers
  )
  .patch(
    "/update-block-unblock-user",
    auth(config.auth_level.admin),
    UserController.updateBlockUnblockUser
  );

module.exports = router;

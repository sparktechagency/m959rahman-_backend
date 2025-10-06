const auth = require("../../middleware/auth");
const express = require("express");
const { uploadFile } = require("../../middleware/fileUploader");
const { SuperAdminController } = require("./superAdmin.controller");
const config = require("../../../config");

const router = express.Router();

// Public route for creating initial super admin (no authentication required)
router.post(
  "/create-initial-super-admin",
  SuperAdminController.createInitialSuperAdmin
);

// Protected routes (require super admin authentication)
router
  .get(
    "/profile",
    auth(config.auth_level.super_admin),
    SuperAdminController.getProfile
  )
  .patch(
    "/edit-profile",
    auth(config.auth_level.super_admin),
    uploadFile({
      name: "profile_image",
      maxCount: 1,  
    }),
    SuperAdminController.updateProfile
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.super_admin),
    SuperAdminController.deleteMyAccount
  )
  .post(
    "/create-super-admin",
    auth(config.auth_level.super_admin),
    uploadFile({
      name: "profile_image",
      maxCount: 1,
    }),
    SuperAdminController.createSuperAdmin
  )
  .get(
    "/get-all-super-admins",
    auth(config.auth_level.super_admin),
    SuperAdminController.getAllSuperAdmins
  );

module.exports = router;

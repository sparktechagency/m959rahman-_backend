const express = require("express");
const auth = require("../../middleware/auth");
const { AuthController } = require("../auth/auth.controller");
const config = require("../../../config");
const limiter = require("../../middleware/limiter");

const router = express.Router();

router
  .post("/register", AuthController.registrationAccount)
  .post("/login", limiter, AuthController.loginAccount)
  .post("/activate-account", AuthController.activateAccount)
  .post("/activation-code-resend", AuthController.resendActivationCode)
  .post("/forgot-password", AuthController.forgotPass)
  .post("/forget-pass-otp-verify", AuthController.forgetPassOtpVerify)
  .post("/reset-password", AuthController.resetPassword)
  .post("/social-signin", AuthController.socialSignIn)
  .post("/social-signin/google", AuthController.socialSignIn)
  .post("/social-signin/facebook", AuthController.socialSignIn)
  .post("/social-signin/microsoft", AuthController.socialSignIn)
  .patch(
    "/change-password",
    auth([...config.auth_level.user, ...config.auth_level.school_admin]),
    AuthController.changePassword
  );

module.exports = router;
 
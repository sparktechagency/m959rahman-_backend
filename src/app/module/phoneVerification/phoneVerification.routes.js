const express = require("express");
const { PhoneVerificationController } = require("./phoneVerification.controller");

const router = express.Router();

router
  .post("/send-code", PhoneVerificationController.sendVerificationCode)
  .post("/verify-code", PhoneVerificationController.verifyPhoneCode);

module.exports = router;
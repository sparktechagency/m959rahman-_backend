const { PhoneVerificationService } = require("./phoneVerification.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const sendVerificationCode = catchAsync(async (req, res) => {
  const result = await PhoneVerificationService.sendVerificationCode(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Verification code sent successfully",
    data: result,
  });
});

const verifyPhoneCode = catchAsync(async (req, res) => {
  const result = await PhoneVerificationService.verifyPhoneCode(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Phone number verified successfully",
    data: result,
  });
});

const PhoneVerificationController = {
  sendVerificationCode,
  verifyPhoneCode,
};

module.exports = { PhoneVerificationController };
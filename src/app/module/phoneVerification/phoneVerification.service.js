const { default: status } = require("http-status");
const Auth = require("../auth/Auth");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const twilio = require('twilio'); // You'll need to install twilio package

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendVerificationCode = async (payload) => {
  validateFields(payload, ["phoneNumber"]);

  const { phoneNumber } = payload;
  
  // Generate a 5-digit verification code
  const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
  
  // Set expiration time (10 minutes from now)
  const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

  try {
    // Send SMS using Twilio (you can use other SMS providers)
    await twilioClient.messages.create({
      body: `Your verification code is: ${verificationCode}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    // Save verification code to user's auth record
    await Auth.findOneAndUpdate(
      { phoneNumber },
      {
        phoneVerificationCode: verificationCode,
        phoneVerificationExpires: verificationExpires,
        isPhoneVerified: false,
      },
      { upsert: true, new: true }
    );

    return { message: "Verification code sent successfully" };
  } catch (error) {
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Failed to send verification code");
  }
};

const verifyPhoneCode = async (payload) => {
  validateFields(payload, ["phoneNumber", "code"]);

  const { phoneNumber, code } = payload;

  const auth = await Auth.findOne({ phoneNumber });

  if (!auth) {
    throw new ApiError(status.NOT_FOUND, "Phone number not found");
  }

  if (auth.phoneVerificationExpires < new Date()) {
    throw new ApiError(status.BAD_REQUEST, "Verification code has expired");
  }

  if (auth.phoneVerificationCode !== code) {
    throw new ApiError(status.BAD_REQUEST, "Invalid verification code");
  }

  // Update auth record
  auth.isPhoneVerified = true;
  auth.phoneVerificationCode = undefined;
  auth.phoneVerificationExpires = undefined;
  await auth.save();

  return { message: "Phone number verified successfully" };
};

const PhoneVerificationService = {
  sendVerificationCode,
  verifyPhoneCode,
};

module.exports = { PhoneVerificationService };
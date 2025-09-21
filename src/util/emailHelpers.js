const { default: status } = require("http-status");
const ApiError = require("../error/ApiError");
const otpResendTemp = require("../mail/otpResendTemp");
const resetPassEmailTemp = require("../mail/resetPassEmailTemp");
const signUpEmailTemp = require("../mail/signUpEmailTemp");
const { sendEmail } = require("./sendEmail");
const addAdminEmailTemp = require("../mail/addAdminEmailTemp");
// const bookingEmailTemp = require("../mail/bookingEmailTemp");
const subscriptionExpiredTemp = require("../mail/subscriptionExpiredTemp");

const sendActivationEmail = async (email, data) => {
  try {
    await sendEmail({
      email,
      subject: "Activate Your Account",
      html: signUpEmailTemp(data),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Email was not sent");
  }
};

const sendOtpResendEmail = async (email, data) => {
  try {
    await sendEmail({
      email,
      subject: "New Activation Code",
      html: otpResendTemp(data),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Email was not sent");
  }
};

const sendResetPasswordEmail = async (email, data) => {
  try {
    await sendEmail({
      email,
      subject: "Password Reset Code",
      html: resetPassEmailTemp(data),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Email was not sent");
  }
};

const sendAddAdminEmailTemp = async (email, data) => {
  try {
    await sendEmail({
      email,
      subject: "Admin Account Created",
      html: addAdminEmailTemp(data),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Email was not sent");
  }
};

const sendSubscriptionEmail = async (email, data) => {
  try {
    await sendEmail({
      email,
      subject: "BetWise Picks Subscription",
      html: bookingEmailTemp(data),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, error.message);
  }
};

const sendSubscriptionExpiredEmail = async (email, data) => {
  try {
    await sendEmail({
      email,
      subject: "BetWise Picks Subscription Expired",
      html: subscriptionExpiredTemp(data),
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, error.message);
  }
};

const EmailHelpers = {
  sendActivationEmail,
  sendOtpResendEmail,
  sendResetPasswordEmail,
  sendAddAdminEmailTemp,
  sendSubscriptionEmail,
  sendSubscriptionExpiredEmail,
};

module.exports = EmailHelpers;

// middleware/subscriptionCheck.js
const ApiError = require("../../error/ApiError");
const httpStatus = require("http-status");
const Teacher = require("../module/teacher/Teacher");

const subscriptionCheck = (requiredPlan = 'basic') => async (req, res, next) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return next();
    }

    const teacher = await Teacher.findOne({ authId: req.user.authId });
    if (!teacher) {
      throw new ApiError(httpStatus.NOT_FOUND, "Teacher profile not found");
    }

    // Check if subscription is active
    if (teacher.subscription.status !== 'active') {
      throw new ApiError(
        httpStatus.PAYMENT_REQUIRED, 
        "Active subscription required to access this feature"
      );
    }

    // Check plan level if needed
    const planHierarchy = { basic: 1, premium: 2, pro: 3 };
    const requiredLevel = planHierarchy[requiredPlan];
    const userLevel = planHierarchy[teacher.subscription.plan];

    if (userLevel < requiredLevel) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        `This feature requires ${requiredPlan} plan or higher`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = subscriptionCheck;
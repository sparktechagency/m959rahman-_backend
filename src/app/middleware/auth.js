const config = require("../../config");
const ApiError = require("../../error/ApiError");
const httpStatus = require("http-status");
const { jwtHelpers } = require("../../util/jwtHelpers");
const { EnumUserRole } = require("../../util/enum");
const Auth = require("../module/auth/Auth");
const Teacher = require("../module/teacher/Teacher"); // Add Teacher model

const auth =
  (roles, isAccessible = true) =>
  async (req, res, next) => {
    try {
      const tokenWithBearer = req.headers.authorization;

      if (!tokenWithBearer && !isAccessible) return next();

      if (!tokenWithBearer)
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          "You are not authorized for this role"
        );

      if (tokenWithBearer.startsWith("Bearer")) {
        const token = tokenWithBearer.split(" ")[1];

        const verifyUser = jwtHelpers.verifyToken(token, config.jwt.secret);

        // Verify user exists and is active
        const isExist = await Auth.findById(verifyUser?.authId);
        if (!isExist) {
          throw new ApiError(httpStatus.UNAUTHORIZED, "User not found");
        }

        // Check if user is blocked
        if (isExist.isBlocked) {
          throw new ApiError(httpStatus.FORBIDDEN, "Your account has been blocked. Please contact support.");
        }

        // Check if user is active (for teachers, they need active account)
        if (!isExist.isActive) {
          throw new ApiError(httpStatus.FORBIDDEN, "Please activate your account first");
        }

        // Validate role
        if (!Object.values(EnumUserRole).includes(verifyUser.role)) {
          throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid user role");
        }

        // For teachers, check subscription status for certain endpoints
        if (verifyUser.role === EnumUserRole.TEACHER) {
          const teacher = await Teacher.findOne({ authId: verifyUser.authId });
          if (!teacher) {
            throw new ApiError(httpStatus.NOT_FOUND, "Teacher profile not found");
          }
          
          // Add teacher subscription info to request
          req.teacher = {
            subscription: teacher.subscription,
            profileId: teacher._id
          };
        }

        req.user = verifyUser;
        // Role-based access control
        if (roles?.length && !roles.includes(verifyUser.role)) {
          throw new ApiError(
            httpStatus.FORBIDDEN,
            "Access Forbidden: You do not have permission to perform this action"
          );
        }

        next();
      } else {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token format");
      }
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'JsonWebTokenError') {
        return next(new ApiError(httpStatus.UNAUTHORIZED, "Invalid token"));
      }
      if (error.name === 'TokenExpiredError') {
        return next(new ApiError(httpStatus.UNAUTHORIZED, "Token has expired"));
      }
      next(error);
    }
  };

module.exports = auth;
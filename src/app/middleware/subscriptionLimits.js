const ApiError = require("../../../error/ApiError");
const { status } = require("http-status");
const Teacher = require("../teacher/Teacher");
const School = require("../school/School");
const Class = require("../class/Class");
const SchoolTeacher = require("../school/SchoolTeacher");
const { getPlanById } = require("../../../config/subscriptionPlans");
const { logger } = require("../../../util/logger");

/**
 * Middleware to check subscription limits before creating resources
 * Usage: subscriptionLimits.checkClassLimit
 */

/**
 * Check if user can create a new class
 */
const checkClassLimit = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        if (role !== "TEACHER" && role !== "SCHOOL") {
            return next();
        }

        const UserModel = role === "TEACHER" ? Teacher : School;
        const user = await UserModel.findById(userId);

        if (!user) {
            throw new ApiError(status.NOT_FOUND, `${role} not found`);
        }

        // Only check limits for active subscriptions
        if (user.subscription?.status !== "active") {
            throw new ApiError(
                status.PAYMENT_REQUIRED,
                "Active subscription required to create classes. Please subscribe to a plan."
            );
        }

        const plan = getPlanById(user.subscription.plan);
        if (!plan || !plan.limits?.classes) {
            return next(); // No limit defined
        }

        // Count existing classes
        let currentClassCount = 0;

        if (role === "TEACHER") {
            currentClassCount = await Class.countDocuments({ teacherId: userId });
        } else if (role === "SCHOOL") {
            // For schools, count classes across all teachers
            currentClassCount = await Class.countDocuments({ schoolId: userId });
        }

        if (currentClassCount >= plan.limits.classes) {
            throw new ApiError(
                status.FORBIDDEN,
                `Class limit reached. Your plan allows ${plan.limits.classes} classes. Please upgrade your subscription.`
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Check if a class can accept more students
 */
const checkStudentLimit = async (req, res, next) => {
    try {
        const { classId } = req.params.id || req.body;

        if (!classId) {
            return next();
        }

        const classDoc = await Class.findById(classId);
        if (!classDoc) {
            throw new ApiError(status.NOT_FOUND, "Class not found");
        }

        // Get teacher/school and their subscription
        const teacherId = classDoc.teacherId;
        const teacher = await Teacher.findById(teacherId);

        if (!teacher) {
            return next(); // Fallback in case teacher not found
        }

        if (teacher.subscription?.status !== "active") {
            throw new ApiError(
                status.PAYMENT_REQUIRED,
                "Teacher must have an active subscription"
            );
        }

        const plan = getPlanById(teacher.subscription.plan);
        if (!plan || !plan.limits?.studentsPerClass) {
            return next();
        }

        // Count current active students
        const currentStudentCount = classDoc.students.filter(
            (s) => s.status === "active"
        ).length;

        if (currentStudentCount >= plan.limits.studentsPerClass) {
            throw new ApiError(
                status.FORBIDDEN,
                `Student limit reached for this class. Maximum ${plan.limits.studentsPerClass} students allowed per class.`
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Check if school can add more teachers
 */
const checkTeacherLimit = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        if (role !== "SCHOOL") {
            return next(); // Only applies to schools
        }

        const school = await School.findById(userId);

        if (!school) {
            throw new ApiError(status.NOT_FOUND, "School not found");
        }

        if (school.subscription?.status !== "active") {
            throw new ApiError(
                status.PAYMENT_REQUIRED,
                "Active subscription required to add teachers"
            );
        }

        const plan = getPlanById(school.subscription.plan);
        if (!plan || !plan.limits?.teachers) {
            return next();
        }

        // Count current teachers
        const currentTeacherCount = await SchoolTeacher.countDocuments({
            schoolId: userId,
            status: "active",
        });

        if (currentTeacherCount >= plan.limits.teachers) {
            throw new ApiError(
                status.FORBIDDEN,
                `Teacher limit reached. Your plan allows ${plan.limits.teachers} teachers. Please upgrade your subscription.`
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    checkClassLimit,
    checkStudentLimit,
    checkTeacherLimit,
};

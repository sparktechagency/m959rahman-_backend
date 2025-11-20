const { status } = require("http-status");
const mongoose = require("mongoose");

const ApiError = require("../../../error/ApiError");
const Teacher = require("../teacher/Teacher");
// const SubscriptionPlan = require("../../models/subscription/SubscriptionPlan");
const Auth = require("../auth/Auth");
const validateFields = require("../../../util/validateFields");
const unlinkFile = require("../../../util/unlinkFile");
const QueryBuilder = require("../../../builder/queryBuilder");
const Student = require("../student/Student");
const Class = require("../class/Class");

const getProfile = async (userData) => {
  const { userId, authId } = userData;

  const [auth, teacher] = await Promise.all([
    Auth.findById(authId).lean(),
    Teacher.findById(userId).populate("authId").lean(),
  ]);

  if (!teacher || !auth) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  if (auth.isBlocked) {
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");
  }

  return {
    ...teacher,
    auth: {
      email: auth.email,
      role: auth.role,
      isVerified: auth.isVerified,
    }
  };
};

const updateProfile = async (req) => {
  const { files, body: data } = req;
  const { userId, authId } = req.user;
  const updateData = { ...data };

  const existingTeacher = await Teacher.findById(userId).lean();

  if (files && files.profile_image) {
    updateData.profile_image = files.profile_image[0].path;
    if (existingTeacher.profile_image) {
      unlinkFile(existingTeacher.profile_image);
    }
  }

  // Update auth name if firstname or lastname is provided
  if (data.firstname || data.lastname) {
    const auth = await Auth.findById(authId);
    if (auth) {
      const newName = `${data.firstname || existingTeacher.firstname} ${data.lastname || existingTeacher.lastname}`;
      auth.name = newName.trim();
      await auth.save();
    }
  }

  const teacher = await Teacher.findByIdAndUpdate(
    userId,
    { ...updateData },
    {
      new: true,
      runValidators: true,
    }
  ).populate("authId");

  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found!");
  }

  return teacher;
};

const getSubscription = async (userData) => {
  const { userId } = userData;

  const teacher = await Teacher.findById(userId)
    .select("subscription firstname lastname email")
    .lean();

  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  // Get subscription plan details
  const subscriptionPlan = await SubscriptionPlan.findOne({
    name: teacher.subscription.plan,
    isActive: true,
  }).lean();

  return {
    teacher: {
      name: `${teacher.firstname} ${teacher.lastname}`,
      email: teacher.email,
    },
    subscription: teacher.subscription,
    planDetails: subscriptionPlan,
  };
};

const updateSubscription = async (userData, payload) => {
  validateFields(payload, ["plan", "autoRenew"]);

  const { userId } = userData;
  const { plan, autoRenew } = payload;

  // Validate plan
  const validPlans = ["basic", "premium", "pro"];
  if (!validPlans.includes(plan)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid subscription plan");
  }

  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  // Calculate subscription dates
  const startDate = teacher.subscription.startDate || new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1); // Default 1 month

  const renewalDate = new Date(endDate);

  teacher.subscription = {
    plan,
    status: "active",
    startDate,
    endDate,
    renewalDate,
    autoRenew: autoRenew !== undefined ? autoRenew : teacher.subscription.autoRenew,
  };

  await teacher.save();

  return teacher.subscription;
};

const cancelSubscription = async (userData) => {
  const { userId } = userData;

  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  if (teacher.subscription.status !== "active") {
    throw new ApiError(status.BAD_REQUEST, "No active subscription to cancel");
  }

  teacher.subscription.status = "cancelled";
  teacher.subscription.autoRenew = false;

  await teacher.save();

  return {
    message: "Subscription cancelled successfully",
    subscription: teacher.subscription,
  };
};

const renewSubscription = async (userData, payload) => {
  validateFields(payload, ["plan"]);

  const { userId } = userData;
  const { plan } = payload;

  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  const renewalDate = new Date(endDate);

  teacher.subscription = {
    plan,
    status: "active",
    startDate,
    endDate,
    renewalDate,
    autoRenew: true,
  };

  await teacher.save();

  return {
    message: "Subscription renewed successfully",
    subscription: teacher.subscription,
  };
};

const getSubscriptionPlans = async () => {
  const plans = await SubscriptionPlan.find({ isActive: true }).lean();

  return plans;
};

const getAllTeachers = async (query) => {
  const teacherQuery = new QueryBuilder(
    Teacher.find({})
      .populate("authId", "email isVerified isBlocked isActive")
      .lean(),
    query
  )
    .search(["firstname", "lastname", "email", "specialization"])
    .sort()
    .paginate();

  const [teachers, meta] = await Promise.all([
    teacherQuery.modelQuery,
    teacherQuery.countTotal(),
  ]);

  // Add full name and format the response (summary view for list)
  const formattedTeachers = teachers.map(teacher => ({
    _id: teacher._id,
    firstName: teacher.firstname,
    lastName: teacher.lastname,
    fullName: `${teacher.firstname} ${teacher.lastname}`,
    email: teacher.email,
    profile_image: teacher.profile_image,
    specialization: teacher.specialization,
    experience: teacher.experience,
    subscription: {
      plan: teacher.subscription?.plan,
      status: teacher.subscription?.status,
    },
    auth: {
      isVerified: teacher.authId?.isVerified,
      isBlocked: teacher.authId?.isBlocked,
      isActive: teacher.authId?.isActive,
    },
    createdAt: teacher.createdAt,
  }));

  return {
    meta,
    teachers: formattedTeachers,
  };
};

const getTeacherById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid teacher ID");
  }

  const teacher = await Teacher.findById(id)
    .populate("authId", "email isVerified isBlocked isActive createdAt updatedAt")
    .lean();

  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }

  // Format the response
  const formattedTeacher = {
    _id: teacher._id,
    firstName: teacher.firstname,
    lastName: teacher.lastname,
    fullName: `${teacher.firstname} ${teacher.lastname}`,
    email: teacher.email,
    profile_image: teacher.profile_image,
    phoneNumber: teacher.phoneNumber,
    dateOfBirth: teacher.dateOfBirth,
    address: teacher.address,
    bio: teacher.bio,
    specialization: teacher.specialization,
    experience: teacher.experience,
    qualifications: teacher.qualifications,
    subscription: teacher.subscription,
    auth: {
      _id: teacher.authId?._id,
      email: teacher.authId?.email,
      isVerified: teacher.authId?.isVerified,
      isBlocked: teacher.authId?.isBlocked,
      isActive: teacher.authId?.isActive,
      createdAt: teacher.authId?.createdAt,
      updatedAt: teacher.authId?.updatedAt,
    },
    createdAt: teacher.createdAt,
    updatedAt: teacher.updatedAt,
  };

  return formattedTeacher;
};

const getAllStudentsForTeacher = async (userData, query) => {
  const { authId } = userData;

  // Get all active classes for the teacher
  const classes = await Class.find({
    teacherId: authId,
    isActive: true,
  })
    .populate({
      path: "students.studentId",
      select: "firstName lastName email profile_image phoneNumber dateOfBirth",
    })
    .lean();

  if (!classes || classes.length === 0) {
    return {
      meta: {
        page: 1,
        limit: 10,
        total: 0,
        totalPage: 0,
      },
      students: [],
      classesSummary: {
        totalClasses: 0,
        classDetails: [],
      },
    };
  }

  // Collect all unique students across all classes
  const studentMap = new Map();

  classes.forEach((classItem) => {
    // Filter only active students
    const activeStudents = classItem.students.filter(
      (s) => s.status === "active" && s.studentId
    );

    activeStudents.forEach((student) => {
      const studentId = student.studentId._id.toString();

      if (!studentMap.has(studentId)) {
        // First time seeing this student
        studentMap.set(studentId, {
          _id: student.studentId._id,
          firstName: student.studentId.firstName || "N/A",
          lastName: student.studentId.lastName || "N/A",
          fullName: `${student.studentId.firstName || ""} ${
            student.studentId.lastName || ""
          }`.trim(),
          email: student.studentId.email,
          profile_image: student.studentId.profile_image,
          phoneNumber: student.studentId.phoneNumber,
          dateOfBirth: student.studentId.dateOfBirth,
          classes: [
            {
              classId: classItem._id,
              className: classItem.name,
              classCode: classItem.classCode,
              joinedAt: student.joinedAt,
            },
          ],
          totalClasses: 1,
        });
      } else {
        // Student already exists, add this class to their list
        const existingStudent = studentMap.get(studentId);
        existingStudent.classes.push({
          classId: classItem._id,
          className: classItem.name,
          classCode: classItem.classCode,
          joinedAt: student.joinedAt,
        });
        existingStudent.totalClasses += 1;
      }
    });
  });

  // Convert map to array
  let students = Array.from(studentMap.values());

  // Apply search filter if searchTerm exists
  const searchTerm = query?.searchTerm;
  if (searchTerm) {
    const searchRegex = new RegExp(searchTerm, "i");
    students = students.filter(
      (student) =>
        searchRegex.test(student.firstName) ||
        searchRegex.test(student.lastName) ||
        searchRegex.test(student.fullName) ||
        searchRegex.test(student.email)
    );
  }

  // Apply sorting
  const sortField = query?.sort || "-fullName";
  const sortOrder = sortField.startsWith("-") ? -1 : 1;
  const field = sortField.replace("-", "");

  students.sort((a, b) => {
    if (field === "totalClasses") {
      return sortOrder * (a.totalClasses - b.totalClasses);
    }
    // Default to fullName sorting
    return sortOrder * a.fullName.localeCompare(b.fullName);
  });

  // Calculate pagination
  const page = Number(query?.page) || 1;
  const limit = Number(query?.limit) || 10;
  const total = students.length;
  const totalPage = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  // Apply pagination
  const paginatedStudents = students.slice(skip, skip + limit);

  // Create classes summary
  const classesSummary = {
    totalClasses: classes.length,
    classDetails: classes.map((classItem) => ({
      _id: classItem._id,
      name: classItem.name,
      classCode: classItem.classCode,
      studentCount: classItem.students.filter((s) => s.status === "active")
        .length,
      assignmentCount: classItem.assignments.filter((a) => a.status === "active")
        .length,
    })),
  };

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    students: paginatedStudents,
    classesSummary,
  };
};

const blockUnblockTeacher = async (id, isBlocked) => {
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found");
  }
  teacher.isBlocked = isBlocked;
  await teacher.save();
  return teacher;
};



const TeacherService = {
  getProfile,
  updateProfile,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionPlans,
  getAllTeachers,
  getTeacherById,
  getAllStudentsForTeacher,
  blockUnblockTeacher
};

module.exports = { TeacherService };
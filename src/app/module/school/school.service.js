const { status } = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../../../error/ApiError");
const School = require("./School");
const SchoolTeacher = require("./SchoolTeacher");
const Teacher = require("../teacher/Teacher");
const Class = require("../class/Class");
const Assignment = require("../class/Assignment");
const StudentAssignment = require("../class/StudentAssignment");
const QueryBuilder = require("../../../builder/queryBuilder");
const Auth = require("../auth/Auth");
const postNotification = require("../../../util/postNotification");


const addTeacherToSchool = async (data, schoolId, authId) => {
  const { email } = data;

  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  if (!email) {
    throw new ApiError(status.BAD_REQUEST, "Email is required");
  }

  // Validate school exists
  const school = await School.findById(schoolId);
  if (!school) {
    throw new ApiError(status.NOT_FOUND, "School not found");
  }

  // Find existing teacher by email
  const teacher = await Teacher.findOne({ email }).populate('authId').lean();

  if (!teacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found with this email");
  }

  // Log teacher info for debugging
  console.log('Adding teacher:', {
    email,
    teacherId: teacher._id,
    authId: teacher.authId?._id,
    firstname: teacher.firstName,
    lastname: teacher.lastName,
    authFirstName: teacher.authId?.firstName,
    authLastName: teacher.authId?.lastName
  });

  // Check if teacher is already added to this school
  const existingRelation = await SchoolTeacher.findOne({
    schoolId,
    teacherId: teacher._id,
  });

  if (existingRelation) {
    if (existingRelation.status === "active") {
      throw new ApiError(status.BAD_REQUEST, "Teacher is already active in this school");
    } else {
      // If blocked, update to active
      existingRelation.status = "active";
      await existingRelation.save();
      return existingRelation;
    }
  }

  // Create new school-teacher relationship
  const schoolTeacher = await SchoolTeacher.create({
    schoolId,
    teacherId: teacher._id,
    addedBy: authId,
    email,
  });

  // Send notification to the teacher
  try {
    await postNotification(
      "Added to School",
      `You have been assigned to "${school.firstName || school.lastName || 'a school'}". Welcome aboard!`,
      teacher.authId?._id || teacher.authId
    );
  } catch (notificationError) {
    console.error("Failed to send teacher notification:", notificationError);
  }

  return schoolTeacher;
};


const getAllTeachersInSchool = async (schoolId, query) => {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  // Validate school exists
  const school = await School.findById(schoolId);
  if (!school) {
    throw new ApiError(status.NOT_FOUND, "School not found");
  }

  const teacherQuery = new QueryBuilder(
    SchoolTeacher.find({ schoolId }),
    query
  )
    .sort({ createdAt: -1 })
    .paginate();

  const [schoolTeachers, meta] = await Promise.all([
    teacherQuery.modelQuery,
    teacherQuery.countTotal(),
  ]);

  // First, let's get all the emails of teachers in the school
  const teacherEmails = schoolTeachers.map(st => st.email).filter(Boolean);

  // Find Auth records by email - this is the source of truth for name data
  // since names are provided during registration in the auth model
  const authDetailsByEmail = await Auth.find({
    email: { $in: teacherEmails }
  }).select('_id email firstName lastName role').lean();

  // Create a map of auth details by email for quick lookup
  const authMapByEmail = {};
  authDetailsByEmail.forEach(auth => {
    if (auth.email) {
      authMapByEmail[auth.email] = auth;
      //   console.log(`Found auth record for ${auth.email}: firstName=${auth.firstName}, lastName=${auth.lastName}`);
    }
  });

  // Get all teacher IDs
  const teacherIds = schoolTeachers.map(st => st.teacherId);
  //   console.log("teacherIds", teacherIds)

  // Get teacher details with all needed fields
  const teacherDetails = await Teacher.find({ _id: { $in: teacherIds } })
    .select('_id authId firstName lastName email profile_image phoneNumber bio specialization')
    .lean();
  //   console.log("teacherDetails", teacherDetails)

  // Create a map of teacher details for quick lookup
  const teachersMap = {};
  teacherDetails.forEach(teacher => {
    teachersMap[teacher._id.toString()] = teacher;
  });

  // Get all authIds from teachers to find auth records directly
  const authIds = teacherDetails
    .map(teacher => teacher.authId)
    .filter(id => id); // filter out any null/undefined IDs

  // Get auth details by ID for backup name data
  const authDetailsById = await Auth.find({
    _id: { $in: authIds }
  }).select('_id email firstName lastName').lean();

  // Create a map of auth details by ID
  const authMapById = {};
  authDetailsById.forEach(auth => {
    if (auth._id) {
      authMapById[auth._id.toString()] = auth;
    }
  });

  //   console.log(`Found: ${teacherEmails.length} emails, ${authDetailsByEmail.length} auth by email, ${teacherDetails.length} teachers, ${authDetailsById.length} auth by ID`);

  // Find all classes for these teachers
  const classes = await Class.find({ teacherId: { $in: teacherIds } });

  // Create a map for class counts per teacher
  const classCountMap = {};
  const studentCountMap = {};

  // Count classes and unique students for each teacher
  classes.forEach(cls => {
    const teacherId = cls.teacherId.toString();

    // Initialize counters if not already set
    if (!classCountMap[teacherId]) {
      classCountMap[teacherId] = 0;
      studentCountMap[teacherId] = new Set();
    }

    // Increment class count
    classCountMap[teacherId]++;

    // Add all student IDs to the set (this will automatically deduplicate)
    cls.students.forEach(student => {
      if (student.status === 'active') {
        studentCountMap[teacherId].add(student.studentId.toString());
      }
    });
  });

  // Format the response with teacher details and statistics
  const formattedTeachers = schoolTeachers.map(st => {
    const teacherId = st.teacherId.toString();
    const teacher = teachersMap[teacherId] || {};
    const teacherEmail = st.email || teacher.email || '';

    // Get name from the Auth record directly by email (most reliable source)
    // or by authId as backup
    const authByEmail = teacherEmail ? authMapByEmail[teacherEmail] : null;
    const authById = teacher.authId ? authMapById[teacher.authId.toString()] : null;

    // Get name from most reliable source first (Auth by email > Auth by ID > Teacher record)
    const firstName =
      authByEmail?.firstName ||
      authById?.firstName ||
      teacher.firstName ||
      '';

    const lastName =
      authByEmail?.lastName ||
      authById?.lastName ||
      teacher.lastName ||
      '';

    // Create full name with proper fallbacks
    let fullName = firstName && lastName ?
      `${firstName} ${lastName}` :
      firstName || lastName ||
      teacherEmail ||
      'Unknown Teacher';

    // Detailed debugging for teacher formatting
    // console.log(`Teacher ${teacherEmail} info sources:`, {
    //   // Info sources
    //   hasAuthByEmail: !!authByEmail,
    //   emailAuthId: authByEmail?._id?.toString(),
    //   hasAuthById: !!authById,
    //   authByIdEmail: authById?.email,

    //   // Name sources
    //   finalFirstName: firstName,
    //   finalLastName: lastName,
    //   authByEmailFirstName: authByEmail?.firstName,
    //   authByEmailLastName: authByEmail?.lastName,
    //   authByIdFirstName: authById?.firstName,
    //   authByIdLastName: authById?.lastName,
    //   teacherFirstname: teacher.firstname,
    //   teacherLastname: teacher.lastname,

    //   // Final output
    //   fullName
    // });

    return {
      relationId: st._id,
      teacherId: teacher._id,
      fullName,
      firstName,
      lastName,
      email: teacherEmail || '',
      profile_image: teacher.profile_image || null,
      phoneNumber: teacher.phoneNumber || '',
      bio: teacher.bio || '',
      specialization: teacher.specialization || '',
      status: st.status,
      joinedAt: st.joinedAt,
      statistics: {
        classesCount: classCountMap[teacherId] || 0,
        studentsCount: studentCountMap[teacherId] ? studentCountMap[teacherId].size : 0
      }
    };
  });

  return {
    meta,
    teachers: formattedTeachers,
  };
};

const getTeacherDetails = async (schoolId, teacherId) => {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid teacher ID");
  }

  // Verify the teacher belongs to this school
  const schoolTeacher = await SchoolTeacher.findOne({
    schoolId,
    teacherId
  });

  if (!schoolTeacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found in this school");
  }

  // Get teacher details
  const teacher = await Teacher.findById(teacherId)
    .select("firstname lastname email profile_image phoneNumber bio specialization");

  // Find all classes created by this teacher
  const classes = await Class.find({ teacherId });

  // Get all student IDs from classes
  const studentIds = classes.flatMap(cls =>
    cls.students.map(student => student.studentId)
  );

  // Remove duplicates
  const uniqueStudentIds = [...new Set(studentIds.map(id => id.toString()))];

  // Get all assignment IDs from classes
  const assignmentIds = classes.flatMap(cls =>
    cls.assignments.map(assignment => assignment.assignmentId)
  );

  // Find all assignments created by this teacher
  const assignments = await Assignment.find({
    _id: { $in: assignmentIds },
    teacherId
  });

  // Get assignment completion stats
  let totalSubmissions = 0;
  let totalCompletions = 0;

  if (assignments.length > 0) {
    const assignmentStats = await StudentAssignment.aggregate([
      {
        $match: {
          assignmentId: { $in: assignments.map(a => a._id) }
        }
      },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          completedAssignments: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
            }
          }
        }
      }
    ]);

    if (assignmentStats.length > 0) {
      totalSubmissions = assignmentStats[0].totalSubmissions;
      totalCompletions = assignmentStats[0].completedAssignments;
    }
  }

  // Calculate completion rate
  const completionRate = totalSubmissions > 0
    ? (totalCompletions / totalSubmissions * 100).toFixed(2)
    : 0;

  return {
    teacherDetails: teacher,
    relationId: schoolTeacher._id,
    status: schoolTeacher.status,
    joinedAt: schoolTeacher.joinedAt,
    statistics: {
      totalClasses: classes.length,
      totalStudents: uniqueStudentIds.length,
      totalAssignments: assignments.length,
      assignmentCompletionRate: `${completionRate}%`
    }
  };
};

const updateTeacherStatus = async (schoolId, teacherId, status) => {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid teacher ID");
  }

  if (!["active", "blocked"].includes(status)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid status. Must be 'active' or 'blocked'");
  }

  const schoolTeacher = await SchoolTeacher.findOne({ schoolId, teacherId });

  if (!schoolTeacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found in this school");
  }

  schoolTeacher.status = status;
  await schoolTeacher.save();

  return schoolTeacher;
};

const removeTeacherFromSchool = async (schoolId, teacherId) => {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid teacher ID");
  }

  // Verify the relation exists before deleting
  const schoolTeacher = await SchoolTeacher.findOne({ schoolId, teacherId });

  if (!schoolTeacher) {
    throw new ApiError(status.NOT_FOUND, "Teacher not found in this school");
  }

  const result = await SchoolTeacher.deleteOne({ schoolId, teacherId });

  if (result.deletedCount === 0) {
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Failed to remove teacher from school");
  }

  return {
    success: true,
    message: "Teacher removed from school successfully",
    data: {
      relationId: schoolTeacher._id,
      teacherId: schoolTeacher.teacherId,
      schoolId: schoolTeacher.schoolId,
      status: schoolTeacher.status
    }
  };
};

const getSchoolDashboardStats = async (schoolId) => {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  // Validate school exists
  const school = await School.findById(schoolId);
  if (!school) {
    throw new ApiError(status.NOT_FOUND, "School not found");
  }

  // Find all teachers in this school
  const schoolTeachers = await SchoolTeacher.find({ schoolId });
  const teacherIds = schoolTeachers.map(st => st.teacherId);

  // Find all classes created by these teachers
  const classes = await Class.find({ teacherId: { $in: teacherIds } });
  const classIds = classes.map(cls => cls._id);

  // Get all student IDs from classes
  const studentIds = classes.flatMap(cls =>
    cls.students.map(student => student.studentId)
  );

  // Remove duplicates
  const uniqueStudentIds = [...new Set(studentIds.map(id => id.toString()))];

  // Find all assignments in these classes
  const assignmentIds = classes.flatMap(cls =>
    cls.assignments.map(assignment => assignment.assignmentId)
  );

  // Get assignment completion stats
  let totalSubmissions = 0;
  let totalCompletions = 0;

  if (assignmentIds.length > 0) {
    const assignmentStats = await StudentAssignment.aggregate([
      {
        $match: {
          assignmentId: { $in: assignmentIds }
        }
      },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          completedAssignments: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
            }
          }
        }
      }
    ]);

    if (assignmentStats.length > 0) {
      totalSubmissions = assignmentStats[0].totalSubmissions;
      totalCompletions = assignmentStats[0].completedAssignments;
    }
  }

  // Calculate completion rate
  const completionRate = totalSubmissions > 0
    ? (totalCompletions / totalSubmissions * 100).toFixed(2)
    : 0;

  return {
    totalTeachers: teacherIds.length,
    totalStudents: uniqueStudentIds.length,
    totalClasses: classes.length,
    totalAssignments: assignmentIds.length,
    assignmentCompletionRate: `${completionRate}%`,
    subscription: {
      plan: school?.subscription?.plan || "basic",
      status: school?.subscription?.status || "inactive"
    }
  };
};

const updateSchoolProfile = async (schoolId, updateData) => {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  // Check if school exists
  const school = await School.findById(schoolId);
  if (!school) {
    throw new ApiError(status.NOT_FOUND, "School not found");
  }

  // Make sure updateData is not null or undefined
  if (!updateData || typeof updateData !== 'object') {
    throw new ApiError(status.BAD_REQUEST, "No update data provided");
  }

  // Fields that are allowed to be updated
  const allowedFields = ['firstName', 'lastName', 'phoneNumber', 'address', 'profile_image', 'cover_image'];

  // Filter out fields that aren't allowed to be updated
  const filteredData = {};
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key) && updateData[key] !== undefined && updateData[key] !== null) {
      filteredData[key] = updateData[key];
    }
  });

  // Handle file uploads - already processed by controller
  if (updateData.profile_image) {
    filteredData.profile_image = updateData.profile_image;
  }

  if (updateData.cover_image) {
    filteredData.cover_image = updateData.cover_image;
  }

  // Check if there are any valid fields to update
  if (Object.keys(filteredData).length === 0) {
    throw new ApiError(status.BAD_REQUEST, "No valid fields to update");
  }

  // Update school profile
  const updatedSchool = await School.findByIdAndUpdate(
    schoolId,
    { $set: filteredData },
    { new: true, runValidators: true }
  );

  return updatedSchool;
};

const getSchoolProfile = async (schoolId) => {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  // Find school by ID
  const school = await School.findById(schoolId)
    .select('_id authId firstName lastName email profile_image phoneNumber address subscription cover_image')
    .populate({
      path: 'authId',
      select: 'firstName lastName email role'
    })
    .lean();

  if (!school) {
    throw new ApiError(status.NOT_FOUND, "School not found");
  }

  // Format the response
  return {
    _id: school._id,
    firstName: school.firstName || school.authId?.firstName || '',
    lastName: school.lastName || school.authId?.lastName || '',
    email: school.email,
    profile_image: school.profile_image,
    phoneNumber: school.phoneNumber || '',
    address: school.address || '',
    cover_image: school.cover_image,
    subscription: {
      plan: school.subscription?.plan || 'basic',
      status: school.subscription?.status || 'inactive',
      stripeSubscriptionId: school.subscription?.stripeSubscriptionId,
      stripeCustomerId: school.subscription?.stripeCustomerId,
      stripePriceId: school.subscription?.stripePriceId,
      stripeProductId: school.subscription?.stripeProductId,
      currentPeriodStart: school.subscription?.currentPeriodStart,
      currentPeriodEnd: school.subscription?.currentPeriodEnd,
      cancelAtPeriodEnd: school.subscription?.cancelAtPeriodEnd,
      canceledAt: school.subscription?.canceledAt,
      startDate: school.subscription?.startDate,
      endDate: school.subscription?.endDate,
      renewalDate: school.subscription?.renewalDate,
      autoRenew: school.subscription?.autoRenew
    }
  };
};

const getMySchoolProfile = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid user ID");
  }

  // Find school by the userId (which is the school's _id from JWT token)
  const school = await School.findById(userId)
    .select('_id authId firstName lastName email profile_image phoneNumber address subscription cover_image')
    .populate({
      path: 'authId',
      select: 'firstName lastName email role'
    })
    .lean();

  if (!school) {
    throw new ApiError(status.NOT_FOUND, "School profile not found");
  }

  // Format the response
  return {
    _id: school._id,
    firstName: school.firstName || school.authId?.firstName || '',
    lastName: school.lastName || school.authId?.lastName || '',
    email: school.email,
    profile_image: school.profile_image,
    phoneNumber: school.phoneNumber || '',
    address: school.address || '',
    cover_image: school.cover_image,
    subscription: {
      plan: school.subscription?.plan || 'basic',
      status: school.subscription?.status || 'inactive',
      stripeSubscriptionId: school.subscription?.stripeSubscriptionId,
      stripeCustomerId: school.subscription?.stripeCustomerId,
      stripePriceId: school.subscription?.stripePriceId,
      stripeProductId: school.subscription?.stripeProductId,
      currentPeriodStart: school.subscription?.currentPeriodStart,
      currentPeriodEnd: school.subscription?.currentPeriodEnd,
      cancelAtPeriodEnd: school.subscription?.cancelAtPeriodEnd,
      canceledAt: school.subscription?.canceledAt,
      startDate: school.subscription?.startDate,
      endDate: school.subscription?.endDate,
      renewalDate: school.subscription?.renewalDate,
      autoRenew: school.subscription?.autoRenew
    }
  };
};

const getAllSchools = async (query) => {
  // Create the base query with full populate for all related information
  const schoolQuery = new QueryBuilder(
    School.find({})
      .populate({
        path: "authId",
        select: "firstName lastName email role createdAt"
      })
      .lean(),
    query
  )
    .search(["firstName", "lastName", "email"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [schoolsRaw, meta] = await Promise.all([
    schoolQuery.modelQuery,
    schoolQuery.countTotal(),
  ]);

  // Get additional information for each school
  const schoolIds = schoolsRaw.map(school => school._id);

  // Count teachers for each school
  const teacherCounts = await SchoolTeacher.aggregate([
    { $match: { schoolId: { $in: schoolIds } } },
    { $group: { _id: "$schoolId", count: { $sum: 1 } } }
  ]);

  // Create a map of teacher counts for quick lookup
  const teacherCountMap = {};
  teacherCounts.forEach(item => {
    teacherCountMap[item._id.toString()] = item.count;
  });

  // Get teacher IDs for each school to find students
  const schoolTeacherMap = {};
  const allTeacherIds = [];

  // Get all school-teacher relationships
  const schoolTeachers = await SchoolTeacher.find({ schoolId: { $in: schoolIds } })
    .lean();

  // Organize teachers by school and collect all teacher IDs
  schoolTeachers.forEach(relation => {
    const schoolId = relation.schoolId.toString();
    const teacherId = relation.teacherId;

    if (!schoolTeacherMap[schoolId]) {
      schoolTeacherMap[schoolId] = [];
    }

    schoolTeacherMap[schoolId].push(teacherId);
    allTeacherIds.push(teacherId);
  });

  // Get classes for all teachers across all schools
  const classes = await Class.find({ teacherId: { $in: allTeacherIds } })
    .select('_id teacherId students')
    .lean();

  // Map classes to teachers
  const teacherClassesMap = {};
  classes.forEach(cls => {
    const teacherId = cls.teacherId.toString();
    if (!teacherClassesMap[teacherId]) {
      teacherClassesMap[teacherId] = [];
    }
    teacherClassesMap[teacherId].push(cls);
  });

  // Count unique students per school
  const schoolStudentCountMap = {};

  // For each school, go through all its teachers' classes and count unique students
  schoolIds.forEach(schoolId => {
    const sId = schoolId.toString();
    const teacherIds = schoolTeacherMap[sId] || [];
    const uniqueStudents = new Set();

    teacherIds.forEach(teacherId => {
      const tId = teacherId.toString();
      const teacherClasses = teacherClassesMap[tId] || [];

      teacherClasses.forEach(cls => {
        cls.students.forEach(student => {
          if (student.status === 'active') {
            uniqueStudents.add(student.studentId.toString());
          }
        });
      });
    });

    schoolStudentCountMap[sId] = uniqueStudents.size;
  });

  // Format the schools with comprehensive information including student counts
  const schools = schoolsRaw.map(school => {
    const schoolId = school._id.toString();

    return {
      _id: school._id,
      authId: school.authId?._id,
      firstName: school.firstName || school.authId?.firstName || '',
      lastName: school.lastName || school.authId?.lastName || '',
      fullName: `${school.firstName || school.authId?.firstName || ''} ${school.lastName || school.authId?.lastName || ''}`.trim(),
      email: school.email,
      profile_image: school.profile_image,
      phoneNumber: school.phoneNumber || '',
      address: school.address || '',
      isBlocked: school.isBlocked || false,
      subscription: {
        plan: school.subscription?.plan || 'basic',
        status: school.subscription?.status || 'inactive'
      },
      statistics: {
        teachersCount: teacherCountMap[schoolId] || 0,
        studentsCount: schoolStudentCountMap[schoolId] || 0
      },
      createdAt: school.createdAt,
      updatedAt: school.updatedAt
    };
  });

  return {
    meta,
    schools,
  };
};

const getSchoolDetails = async (schoolId) => {
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid school ID");
  }

  // Find school by ID with all relevant information
  const school = await School.findById(schoolId)
    .populate({
      path: 'authId',
      select: 'firstName lastName email role createdAt'
    })
    .lean();

  if (!school) {
    throw new ApiError(status.NOT_FOUND, "School not found");
  }

  // Get teacher count for this school
  const teacherCount = await SchoolTeacher.countDocuments({ schoolId });

  // Get all teacher IDs in this school
  const teacherRelations = await SchoolTeacher.find({ schoolId });
  const teacherIds = teacherRelations.map(relation => relation.teacherId);

  // Count classes in this school
  const classCount = await Class.countDocuments({ teacherId: { $in: teacherIds } });

  // Get student count (unique students across all classes)
  const classes = await Class.find({ teacherId: { $in: teacherIds } });
  const studentSet = new Set();
  classes.forEach(cls => {
    cls.students.forEach(student => {
      if (student.status === 'active') {
        studentSet.add(student.studentId.toString());
      }
    });
  });
  const studentCount = studentSet.size;

  // Get assignments count
  const assignmentCount = await Assignment.countDocuments({
    classId: { $in: classes.map(cls => cls._id) }
  });

  // Format the response with all details
  return {
    _id: school._id,
    authId: school.authId?._id,
    firstName: school.firstName || school.authId?.firstName || '',
    lastName: school.lastName || school.authId?.lastName || '',
    fullName: `${school.firstName || school.authId?.firstName || ''} ${school.lastName || school.authId?.lastName || ''}`.trim(),
    email: school.email,
    profile_image: school.profile_image,
    phoneNumber: school.phoneNumber || '',
    address: school.address || '',
    cover_image: school.cover_image,
    isBlocked: school.isBlocked || false,
    subscription: {
      plan: school.subscription?.plan || 'basic',
      status: school.subscription?.status || 'inactive'


    },
    statistics: {
      teacherCount,
      classCount,
      studentCount,
      assignmentCount
    },
    createdAt: school.createdAt,
    updatedAt: school.updatedAt
  };
};

const blockUnblockSchool = async (schoolId, isBlocked) => {
  const school = await School.findById(schoolId);
  if (!school) {
    throw new ApiError(status.NOT_FOUND, "School not found");
  }
  school.isBlocked = isBlocked;
  await school.save();
  return school;
};

module.exports = {
  addTeacherToSchool,
  getAllTeachersInSchool,
  getTeacherDetails,
  updateTeacherStatus,
  removeTeacherFromSchool,
  getSchoolDashboardStats,
  updateSchoolProfile,
  getSchoolProfile,
  getMySchoolProfile,
  getAllSchools,
  getSchoolDetails,
  blockUnblockSchool
};


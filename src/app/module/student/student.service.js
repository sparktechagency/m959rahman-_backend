const { status } = require("http-status");
const ApiError = require("../../../error/ApiError");
const Student = require("./Student");
const Auth = require("../auth/Auth");
const { deleteFromS3, extractS3KeyFromUrl } = require("../../../util/s3Utils");
const validateFields = require("../../../util/validateFields");
const QueryBuilder = require("../../../builder/queryBuilder");
const mongoose = require("mongoose");
const StudentAssignment = require("../class/StudentAssignment");
const Assignment = require("../class/Assignment");
const Class = require("../class/Class");

const updateProfile = async (req) => {
  const { files, body: data } = req;
  const { userId, authId } = req.user;
  const updateData = { ...data };

  if (data?.profile_image === "")
    throw new ApiError(status.BAD_REQUEST, `Missing profile image`);

  const existingStudent = await Student.findById(userId).lean();

  if (files && files.profile_image) {
    updateData.profile_image = files.profile_image[0].location;
    if (existingStudent.profile_image) {
      const s3Key = extractS3KeyFromUrl(existingStudent.profile_image);
      if (s3Key) {
        deleteFromS3(s3Key).catch(err => console.warn("Failed to delete old profile image:", err));
      }
    }
  }

  const [auth, student] = await Promise.all([
    Auth.findByIdAndUpdate(
      authId,
      { name: updateData.name },
      {
        new: true,
      }
    ),
    Student.findByIdAndUpdate(
      userId,
      { ...updateData },
      {
        new: true,
      }
    ).populate("authId"),
  ]);

  if (!auth || !student) throw new ApiError(status.NOT_FOUND, "Student not found!");

  return student;
};

const getProfile = async (studentData) => {
  const { userId, authId } = studentData;

  const [auth, result] = await Promise.all([
    Auth.findById(authId).lean(),
    Student.findById(userId).populate("authId").lean(),
  ]);

  // if (!result.isSubscribed)
  //   throw new ApiError(status.FORBIDDEN, "Not subscribed");

  if (!result || !auth) throw new ApiError(status.NOT_FOUND, "Student not found");
  if (auth.isBlocked)
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");

  return result;
};

const deleteMyAccount = async (payload) => {
  const { email, password } = payload;

  const isStudentExist = await Auth.isAuthExist(email);
  if (!isStudentExist) throw new ApiError(status.NOT_FOUND, "Student does not exist");
  if (
    isStudentExist.password &&
    !(await Auth.isPasswordMatched(password, isStudentExist.password))
  ) {
    throw new ApiError(status.FORBIDDEN, "Password is incorrect");
  }

  Promise.all([
    Auth.deleteOne({ email }),
    Student.deleteOne({ authId: isStudentExist._id }),
  ]);
};

const getStudent = async (query) => {
  validateFields(query, ["userId"]);

  const student = await Student.findOne({ _id: query.userId })
    .populate("authId")
    .lean();

  if (!student) throw new ApiError(status.NOT_FOUND, "Student not found");

  return student;
};

const getAllStudents = async (studentData, query) => {
  const studentQuery = new QueryBuilder(
    Student.find({}).populate("authId").lean(),
    query
  )
    .search(["email", "name"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [students, meta] = await Promise.all([
    studentQuery.modelQuery,
    studentQuery.countTotal(),
  ]);

  return {
    meta,
    students,
  };
};

const updateBlockUnblockStudent = async (studentData, payload) => {
  validateFields(payload, ["authId", "isBlocked"]);
  const { authId, isBlocked } = payload;

  const student = await Auth.findByIdAndUpdate(
    authId,
    { isBlocked },
    { new: true, runValidators: true }
  );

  if (!student) throw new ApiError(status.NOT_FOUND, "Student not found");

  return student;
};

// Get all students for admin with pagination and search
const getAllStudentsForAdmin = async (query) => {
  // Create query with full populate for all related information
  const studentQuery = new QueryBuilder(
    Student.find()
      .populate({
        path: 'authId',
        select: 'firstName lastName email phoneNumber role isActive createdAt'
      })
      .lean(),
    query
  )
    .search(['firstName', 'lastName', 'email', 'studentId'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [studentsRaw, meta] = await Promise.all([
    studentQuery.modelQuery,
    studentQuery.countTotal(),
  ]);

  // Get all student IDs
  const studentIds = studentsRaw.map(student => student._id);

  // Get classes information for each student (which classes they are enrolled in)
  const classes = await Class.find({ 'students.studentId': { $in: studentIds } })
    .select('_id name subject grade teacherId students')
    .populate({
      path: 'teacherId',
      select: 'firstname lastname email profile_image'
    })
    .lean();

  // Process class information with teacher details
  const classEnrollmentMap = {};

  classes.forEach(cls => {
    // Extract teacher information
    const teacher = {
      id: cls.teacherId?._id,
      name: `${cls.teacherId?.firstname || ''} ${cls.teacherId?.lastname || ''}`.trim() || 'Unknown Teacher',
      email: cls.teacherId?.email || '',
      profile_image: cls.teacherId?.profile_image || null
    };

    // Find all students in this class
    cls.students.forEach(student => {
      if (!studentIds.some(id => id.toString() === student.studentId.toString())) {
        return; // Skip if not in our target students
      }

      const studentId = student.studentId.toString();

      if (!classEnrollmentMap[studentId]) {
        classEnrollmentMap[studentId] = {
          classCount: 0,
          classes: []
        };
      }

      // Add class with teacher information
      if (classEnrollmentMap[studentId].classes.length < 5) { // Limit to 5 classes for preview
        classEnrollmentMap[studentId].classes.push({
          classId: cls._id,
          className: cls.name,
          subject: cls.subject,
          grade: cls.grade,
          status: student.status,
          enrolledAt: student.enrolledAt,
          teacher: teacher
        });
      }

      classEnrollmentMap[studentId].classCount++;
    });
  });

  // Get assignment completion statistics
  const assignmentStats = await Assignment.aggregate([
    { $match: { 'submissions.studentId': { $in: studentIds } } },
    { $unwind: '$submissions' },
    { $match: { 'submissions.studentId': { $in: studentIds } } },
    {
      $group: {
        _id: '$submissions.studentId',
        totalAssignments: { $sum: 1 },
        completedAssignments: { $sum: { $cond: [{ $eq: ['$submissions.status', 'completed'] }, 1, 0] } }
      }
    }
  ]);

  // Create a map for quick lookup
  const assignmentStatsMap = {};
  assignmentStats.forEach(item => {
    assignmentStatsMap[item._id.toString()] = {
      totalAssignments: item.totalAssignments,
      completedAssignments: item.completedAssignments,
      completionRate: item.totalAssignments > 0 ?
        Math.round((item.completedAssignments / item.totalAssignments) * 100) : 0
    };
  });

  // Format students with all information
  const students = studentsRaw.map(student => {
    const studentId = student._id.toString();
    const enrollmentInfo = classEnrollmentMap[studentId] || { classCount: 0, classes: [] };
    const assignmentInfo = assignmentStatsMap[studentId] ||
      { totalAssignments: 0, completedAssignments: 0, completionRate: 0 };

    return {
      _id: student._id,
      authId: student.authId?._id,
      firstName: student.firstName || student.authId?.firstName || '',
      lastName: student.lastName || student.authId?.lastName || '',
      fullName: `${student.firstName || student.authId?.firstName || ''} ${student.lastName || student.authId?.lastName || ''}`.trim(),
      email: student.email || student.authId?.email || '',
      phoneNumber: student.phoneNumber || student.authId?.phoneNumber || '',
      profile_image: student.profile_image || null,
      studentId: student.studentId || '',
      isBlocked: student.isBlocked || false,
      grade: student.grade || '',
      dateOfBirth: student.dateOfBirth || null,
      gender: student.gender || '',
      address: student.address || '',
      parentInfo: student.parentInfo || null,
      academicInfo: student.academicInfo || null,
      classEnrollment: {
        count: enrollmentInfo.classCount,
        classes: enrollmentInfo.classes
      },
      assignments: assignmentInfo,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    };
  });

  return {
    meta,
    students,
  };
};

// Get single student details by ID for admin
const getStudentDetailsForAdmin = async (studentId) => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid student ID');
  }

  // Get comprehensive student information
  const student = await Student.findById(studentId)
    .populate({
      path: 'authId',
      select: 'firstName lastName email phoneNumber role isActive createdAt'
    })
    .lean();

  if (!student) {
    throw new ApiError(status.NOT_FOUND, 'Student not found');
  }

  // Get class enrollments for this student
  const classEnrollments = await Class.find({ 'students.studentId': studentId })
    .select('_id name description subject grade teacherId students')
    .populate({
      path: 'teacherId',
      select: 'firstname lastname email profile_image'
    })
    .lean();

  // Format class enrollments with student-specific status
  const classes = classEnrollments.map(cls => {
    const studentEntry = cls.students.find(
      s => s.studentId.toString() === studentId.toString()
    );

    return {
      classId: cls._id,
      name: cls.name,
      subject: cls.subject,
      grade: cls.grade,
      description: cls.description,
      teacher: {
        id: cls.teacherId?._id,
        name: `${cls.teacherId?.firstname || ''} ${cls.teacherId?.lastname || ''}`.trim() || 'Unknown Teacher',
        email: cls.teacherId?.email || '',
        profile_image: cls.teacherId?.profile_image || null
      },
      enrollmentStatus: studentEntry?.status || 'unknown',
      enrollmentDate: studentEntry?.enrolledAt || null,
      totalStudents: cls.students.length
    };
  });

  // Get assignment submissions for this student
  const assignments = await Assignment.find({ 'submissions.studentId': studentId })
    .select('_id title description dueDate classId submissions')
    .populate({
      path: 'classId',
      select: 'name subject'
    })
    .lean();

  // Format assignment information with submission details
  const formattedAssignments = assignments.map(assignment => {
    const submission = assignment.submissions.find(
      s => s.studentId.toString() === studentId.toString()
    );

    return {
      assignmentId: assignment._id,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate,
      class: {
        id: assignment.classId?._id,
        name: assignment.classId?.name || '',
        subject: assignment.classId?.subject || ''
      },
      submission: submission ? {
        status: submission.status,
        submittedAt: submission.submittedAt,
        grade: submission.grade,
        feedback: submission.feedback,
        attachments: submission.attachments || []
      } : null
    };
  });

  // Format comprehensive response
  return {
    _id: student._id,
    authId: student.authId?._id,
    firstName: student.firstName || student.authId?.firstName || '',
    lastName: student.lastName || student.authId?.lastName || '',
    fullName: `${student.firstName || student.authId?.firstName || ''} ${student.lastName || student.authId?.lastName || ''}`.trim(),
    email: student.email || student.authId?.email || '',
    phoneNumber: student.phoneNumber || student.authId?.phoneNumber || '',
    profile_image: student.profile_image || null,
    studentId: student.studentId || '',
    isBlocked: student.isBlocked || false,
    grade: student.grade || '',
    dateOfBirth: student.dateOfBirth || null,
    gender: student.gender || '',
    address: student.address || '',
    parentInfo: student.parentInfo || null,
    academicInfo: student.academicInfo || null,
    statistics: {
      totalClasses: classes.length,
      totalAssignments: formattedAssignments.length,
      completedAssignments: formattedAssignments.filter(a => a.submission?.status === 'completed').length,
      pendingAssignments: formattedAssignments.filter(a => a.submission?.status === 'pending').length
    },
    classes: classes,
    assignments: formattedAssignments,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt
  };
};

// Get all assignments assigned to the authenticated student
const getMyAssignments = async (studentData, query) => {
  const { userId } = studentData;

  // Verify student exists
  const student = await Student.findById(userId);
  if (!student) {
    throw new ApiError(status.NOT_FOUND, "Student not found");
  }

  // Build query for student assignments
  const assignmentQuery = new QueryBuilder(
    StudentAssignment.find({ studentId: userId, status: { $ne: 'inactive' } })
      .populate({
        path: 'assignmentId',
        select: 'assignmentName description dueDate totalMarks duration curriculumId topicId',
        populate: [
          {
            path: 'curriculumId',
            select: 'name',
            match: { isActive: true }
          },
          {
            path: 'topicId',
            select: 'name',
            match: { isActive: true }
          }
        ]
      })
      .populate({
        path: 'classId',
        select: 'name classCode',
        match: { isActive: true }
      })
      .sort('-createdAt')
      .lean(),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const [assignments, meta] = await Promise.all([
    assignmentQuery.modelQuery,
    assignmentQuery.countTotal(),
  ]);

  // Filter out assignments where assignmentId or classId is null (deleted)
  const validAssignments = assignments.filter(
    a => a.assignmentId !== null && a.classId !== null
  );

  // Format response
  const formattedAssignments = validAssignments.map(assignment => ({
    _id: assignment._id,
    assignment: {
      _id: assignment.assignmentId._id,
      name: assignment.assignmentId.assignmentName || 'Untitled Assignment',
      description: assignment.assignmentId.description || 'No description available',
      dueDate: assignment.assignmentId.dueDate,
      totalMarks: assignment.assignmentId.totalMarks || 0,
      duration: assignment.assignmentId.duration || 0,
      curriculum: assignment.assignmentId.curriculumId?.name || 'General',
      topic: assignment.assignmentId.topicId?.name || 'General Topic'
    },
    class: {
      _id: assignment.classId._id,
      name: assignment.classId.name || 'Unknown Class',
      classCode: assignment.classId.classCode || 'N/A'
    },
    status: assignment.status || 'pending',
    totalMarksObtained: assignment.totalMarksObtained || 0,
    completionRate: assignment.completionRate || 0,
    startedAt: assignment.startedAt,
    submittedAt: assignment.submittedAt,
    gradedAt: assignment.gradedAt,
    createdAt: assignment.createdAt
  }));

  return {
    meta,
    assignments: formattedAssignments,
  };
};

// Get single assignment details for student
const getAssignmentDetails = async (studentData, assignmentId) => {
  const { userId } = studentData;

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
  }

  // Find the student assignment
  const studentAssignment = await StudentAssignment.findOne({
    _id: assignmentId,
    studentId: userId
  })
    .populate({
      path: 'assignmentId',
      populate: [
        {
          path: 'questions',
          select: 'questionText questionImage attachments'
        },
        { path: 'curriculumId', select: 'name' },
        { path: 'topicId', select: 'name' }
      ]
    })
    .populate({
      path: 'classId',
      select: 'name classCode'
    })
    .lean();

  if (!studentAssignment) {
    throw new ApiError(status.NOT_FOUND, "Assignment not found or not assigned to you");
  }

  if (!studentAssignment.assignmentId) {
    throw new ApiError(status.NOT_FOUND, "Assignment has been deleted");
  }

  return {
    _id: studentAssignment._id,
    assignment: studentAssignment.assignmentId,
    class: studentAssignment.classId,
    answers: studentAssignment.answers,
    totalMarksObtained: studentAssignment.totalMarksObtained,
    completionRate: studentAssignment.completionRate,
    status: studentAssignment.status,
    startedAt: studentAssignment.startedAt,
    submittedAt: studentAssignment.submittedAt,
    gradedAt: studentAssignment.gradedAt
  };
};

const joinClassByCode = async (userData, data) => {
  validateFields(data, ["classCode"]);

  const { userId } = userData;

  // Verify student exists
  const student = await Student.findById(userId);
  if (!student) {
    throw new ApiError(status.NOT_FOUND, "Student not found");
  }

  // Find class by code (must be active)
  const classData = await Class.findOne({
    classCode: data.classCode.toUpperCase(), // Normalize to uppercase
    isActive: true
  });

  if (!classData) {
    throw new ApiError(status.NOT_FOUND, "Invalid class code or class not found");
  }

  // Check if class has reached maximum students
  const activeStudents = classData.students.filter(s => s.status === 'active');
  if (activeStudents.length >= classData.maxStudents) {
    throw new ApiError(status.BAD_REQUEST, "Class has reached maximum student capacity");
  }

  // Check if student is already in class
  const existingStudent = classData.students.find(
    s => s.studentId.toString() === userId
  );

  if (existingStudent && existingStudent.status === 'active') {
    throw new ApiError(status.BAD_REQUEST, "You are already enrolled in this class");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (existingStudent && existingStudent.status === 'inactive') {
      // Reactivate inactive student
      await Class.updateOne(
        {
          _id: classData._id,
          "students.studentId": userId
        },
        {
          $set: { "students.$.status": "active" },
          $set: { "students.$.joinedAt": new Date() }
        },
        { session }
      );

      // Reactivate student assignments
      await StudentAssignment.updateMany(
        {
          studentId: userId,
          classId: classData._id,
          status: "inactive"
        },
        { status: "not_started" },
        { session }
      );
    } else {
      // Add new student to class
      await Class.updateOne(
        { _id: classData._id },
        {
          $push: {
            students: {
              studentId: userId,
              status: 'active',
              joinedAt: new Date()
            }
          }
        },
        { session }
      );

      // Assign all active, published, and non-expired assignments to this student
      const activeAssignments = classData.assignments.filter(a => a.status === 'active');

      if (activeAssignments.length > 0) {
        const validAssignments = [];

        // Check each assignment for publishStatus and dueDate validity
        for (const assignment of activeAssignments) {
          const fullAssignment = await Assignment.findById(assignment.assignmentId).session(session);

          // Only assign if:
          // 1. Assignment exists (not deleted)
          // 2. Assignment is published
          // 3. Assignment hasn't expired (dueDate is in the future or no dueDate set)
          if (fullAssignment &&
            fullAssignment.publishStatus === 'published' &&
            (!fullAssignment.dueDate || new Date(fullAssignment.dueDate) > new Date())) {
            validAssignments.push({
              studentId: userId,
              assignmentId: assignment.assignmentId,
              classId: classData._id,
              status: "not_started"
            });
          }
        }

        if (validAssignments.length > 0) {
          await StudentAssignment.insertMany(validAssignments, { session });
        }
      }
    }

    await session.commitTransaction();

    // Send notification to student
    try {
      await postNotification(
        "Successfully Joined Class",
        `You have successfully joined the class "${classData.name}" using class code ${data.classCode}. Check your dashboard for new assignments.`,
        userId
      );
    } catch (notificationError) {
      console.error("Failed to send join notification:", notificationError);
    }

    // Return updated class info
    const updatedClass = await Class.findById(classData._id)
      .populate("teacherId", "firstName lastName email")
      .lean();

    return {
      success: true,
      message: `Successfully joined class "${classData.name}"`,
      class: {
        _id: updatedClass._id,
        name: updatedClass.name,
        classCode: updatedClass.classCode,
        teacher: {
          firstName: updatedClass.teacherId.firstName,
          lastName: updatedClass.teacherId.lastName,
          email: updatedClass.teacherId.email
        },
        studentCount: updatedClass.students.filter(s => s.status === 'active').length,
        assignmentCount: updatedClass.assignments.filter(a => a.status === 'active').length,
        joinedAt: new Date()
      }
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const StudentService = {
  getProfile,
  deleteMyAccount,
  updateProfile,
  getStudent,
  getAllStudents,
  updateBlockUnblockStudent,
  getAllStudentsForAdmin,
  getStudentDetailsForAdmin,
  getMyAssignments,
  getAssignmentDetails,
  joinClassByCode
};

module.exports = { StudentService };

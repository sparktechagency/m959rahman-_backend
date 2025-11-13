const { status } = require("http-status");
const ApiError = require("../../../error/ApiError");
const Student = require("./Student");
const Auth = require("../auth/Auth");
const unlinkFile = require("../../../util/unlinkFile");
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
    updateData.profile_image = files.profile_image[0].path;
    if (existingStudent.profile_image) unlinkFile(existingStudent.profile_image);
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
  const studentQuery = new QueryBuilder(
    Student.find()
      .populate({
        path: 'authId',
        select: 'name email phoneNumber role isActive',
      })
      .select('-__v -createdAt -updatedAt')
      .lean(),
    query
  )
    .search(['name', 'email', 'studentId'])
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

// Get single student details by ID for admin
const getStudentDetailsForAdmin = async (studentId) => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid student ID');
  }

  const student = await Student.findById(studentId)
    .populate({
      path: 'authId',
      select: 'name email phoneNumber role isActive',
    })
    .select('-__v -createdAt -updatedAt')
    .lean();

  if (!student) {
    throw new ApiError(status.NOT_FOUND, 'Student not found');
  }

  return student;
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

            // Assign all active assignments to this student
            const activeAssignments = classData.assignments.filter(a => a.status === 'active');
            
            if (activeAssignments.length > 0) {
                const studentAssignments = activeAssignments.map(assignment => ({
                    studentId: userId,
                    assignmentId: assignment.assignmentId,
                    classId: classData._id,
                    status: "not_started"
                }));

                await StudentAssignment.insertMany(studentAssignments, { session });
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

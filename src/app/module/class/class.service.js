const { status } = require("http-status");
const mongoose = require("mongoose");

const ApiError = require("../../../error/ApiError");
const Class = require("../../module/class/Class");
const Assignment = require("../../module/class/Assignment");
const StudentAssignment = require("../../module/class/StudentAssignment");
const Student = require("../../module/student/Student");
const Auth = require("../../module/auth/Auth");
const validateFields = require("../../../util/validateFields");
const QueryBuilder = require("../../../builder/queryBuilder");
const Curriculum = require("../../module/curriculum/Curriculum");
const Topic = require("../../module/curriculum/Topic");
const Question = require("../../module/curriculum/Question");
const postNotification = require("../../../util/postNotification");

const createClass = async (req) => {
    const { body: data, user } = req;
    validateFields(data, ["name"]);

    // Check if teacher already has 7 active classes
    const classCount = await Class.countDocuments({
        teacherId: user.authId,
        isActive: true,
    });

    if (classCount >= 7) {
        throw new ApiError(status.BAD_REQUEST, "You can only create up to 7 classes");
    }

    const newClass = await Class.create({
        name: data.name,
        teacherId: user.authId,
    });

    return newClass;
};

const getMyClasses = async (userData, query) => {
    const classQuery = new QueryBuilder(
        Class.find({
            teacherId: userData.authId,
            isActive: true
        })
            .populate("students.studentId", "firstName lastName email")
            .populate("assignments.assignmentId", "title assignmentCode")
            .lean(),
        query
    )
        .search(["name", "classCode"])
        .sort()
        .paginate();

    const [classes, meta] = await Promise.all([
        classQuery.modelQuery,
        classQuery.countTotal(),
    ]);

    // Add student counts and assignment counts
    classes.forEach(classItem => {
        classItem.studentCount = classItem.students.filter(s => s.status === 'active').length;
        classItem.assignmentCount = classItem.assignments.filter(a => a.status === 'active').length;
    });

    return {
        meta,
        classes,
    };
};

const getClassById = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const classData = await Class.findById(id)
        .populate("students.studentId", "firstName lastName email profile_image")
        .populate("assignments.assignmentId", "title assignmentCode description totalMarks duration")
        .lean();

    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    return classData;
};

const updateClass = async (id, data) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const updatedClass = await Class.findByIdAndUpdate(
        id,
        { ...data },
        { new: true, runValidators: true }
    )
        .populate("students.studentId", "firstName lastName email")
        .populate("assignments.assignmentId", "title assignmentCode");

    if (!updatedClass) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    return updatedClass;
};

const deleteClass = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const classData = await Class.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true, session }
        );

        if (!classData) {
            throw new ApiError(status.NOT_FOUND, "Class not found");
        }

        // Remove all student assignments for this class
        await StudentAssignment.updateMany(
            { classId: id },
            { status: "inactive" },
            { session }
        );

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const addStudentToClass = async (classId, data) => {
    validateFields(data, ["studentEmail"]);

    if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the class
        const classData = await Class.findById(classId).session(session);
        if (!classData) {
            throw new ApiError(status.NOT_FOUND, "Class not found");
        }

        // Check if class has reached maximum students
        const activeStudents = classData.students.filter(s => s.status === 'active');
        if (activeStudents.length >= classData.maxStudents) {
            throw new ApiError(status.BAD_REQUEST, "Class has reached maximum student capacity");
        }

        // Find student by email
        const student = await Student.findOne({
            email: data.studentEmail
        }).session(session);

        console.log("student", student)

        if (!student) {
            throw new ApiError(status.NOT_FOUND, "Student not found");
        }

        // Check if student is already in class (including inactive students)
        const existingStudent = classData.students.find(
            s => s.studentId.toString() === student._id.toString()
        );

        console.log("Adding student to class:", {
            classId,
            studentId: student._id,
            studentEmail: data.studentEmail,
            existingStudent: existingStudent ? {
                studentId: existingStudent.studentId,
                status: existingStudent.status
            } : null
        });

        if (existingStudent) {
            if (existingStudent.status === 'active') {
                throw new ApiError(status.BAD_REQUEST, "Student is already active in this class");
            } else {
                // Reactivate the student instead of adding a new entry
                existingStudent.status = 'active';
                await classData.save({ session });
                
                // Reactivate student assignments
                await StudentAssignment.updateMany(
                    {
                        studentId: student._id,
                        classId: classId,
                        status: "inactive"
                    },
                    { status: "not_started" },
                    { session }
                );

                await session.commitTransaction();

                return await Class.findById(classId)
                    .populate("students.studentId", "firstName lastName email")
                    .populate("assignments.assignmentId", "title assignmentCode");
            }
        }

        // console.log(student)

        // Add student to class
        classData.students.push({
            studentId: student._id,
            status: 'active'
        });

        await classData.save({ session });

        // Assign all active assignments to this student
        const activeAssignments = classData.assignments.filter(a => a.status === 'active');

        for (const assignment of activeAssignments) {
            const studentAssignment = new StudentAssignment({
                studentId: student._id,
                assignmentId: assignment.assignmentId,
                classId: classId,
                status: "not_started"
            });
            await studentAssignment.save({ session });
        }

        await session.commitTransaction();

        // Send notification to the student when added to class
        try {
            await postNotification(
                "Added to Class",
                `You have been added to the class "${classData.name}". Check your dashboard for new assignments.`,
                student._id
            );
        } catch (notificationError) {
            console.error("Failed to send student notification:", notificationError);
        }

        return await Class.findById(classId)
            .populate("students.studentId", "firstName lastName email")
            .populate("assignments.assignmentId", "title assignmentCode");
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// const removeStudentFromClass = async (classId, data) => {
//     validateFields(data, ["studentId"]);

//     if (!mongoose.Types.ObjectId.isValid(classId)) {
//         throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const classData = await Class.findById(classId).session(session);
//         if (!classData) {
//             throw new ApiError(status.NOT_FOUND, "Class not found");
//         }

//         // Remove student from class (soft delete)
//         const studentIndex = classData.students.findIndex(
//             s => s.studentId.toString() === data.studentId && s.status === 'active'
//         );

//         if (studentIndex === -1) {
//             throw new ApiError(status.NOT_FOUND, "Student not found in this class");
//         }

//         classData.students[studentIndex].status = 'inactive';
//         await classData.save({ session });

//         // Remove student assignments for this class
//         await StudentAssignment.updateMany(
//             {
//                 studentId: data.studentId,
//                 classId: classId
//             },
//             { status: "inactive" },
//             { session }
//         );

//         await session.commitTransaction();

//         return await Class.findById(classId)
//             .populate("students.studentId", "firstName lastName email")
//             .populate("assignments.assignmentId", "title assignmentCode");
//     } catch (error) {
//         await session.abortTransaction();
//         throw error;
//     } finally {
//         session.endSession();
//     }
// };

const removeStudentFromClass = async (classId, data) => {
    validateFields(data, ["studentEmail"]);

    // Find student by email
    const student = await Student.findOne({ 
        email: data.studentEmail
    });

    if (!student) {
        throw new ApiError(status.NOT_FOUND, "Student not found");
    }

    console.log("Removing student:", {
        classId,
        studentId: student._id,
        studentEmail: data.studentEmail
    });

    // First check current status
    const classBefore = await Class.findById(classId);
    if (!classBefore) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    const currentStudentStatus = classBefore.students.find(
        s => s.studentId.toString() === student._id.toString()
    );
    
    console.log("Current student status in class:", currentStudentStatus);

    // Execute both operations in parallel
    const [classResult, assignmentResult] = await Promise.all([
        // Update student status in class
        Class.updateOne(
            { 
                _id: classId, 
                "students.studentId": student._id
            },
            { $set: { "students.$.status": "inactive" } }
        ),
        // Update student assignments
        StudentAssignment.updateMany(
            {
                studentId: student._id,
                classId: classId
            },
            { status: "inactive" }
        )
    ]);

    console.log("Update results:", {
        classMatchedCount: classResult.matchedCount,
        classModifiedCount: classResult.modifiedCount,
        assignmentsUpdated: assignmentResult.modifiedCount
    });

    if (classResult.matchedCount === 0) {
        throw new ApiError(status.NOT_FOUND, "Student not found in this class");
    }

    // Verify the update worked
    const classAfter = await Class.findById(classId);
    const updatedStatus = classAfter.students.find(
        s => s.studentId.toString() === student._id.toString()
    );
    
    console.log("Updated student status:", updatedStatus);

    return {
        success: true,
        message: "Student removed from class successfully",
        studentEmail: data.studentEmail,
        updatedAssignments: assignmentResult.modifiedCount,
        classResult: {
            matchedCount: classResult.matchedCount,
            modifiedCount: classResult.modifiedCount
        }
    };
};

const getStudentsInClass = async (classId) => {
    console.log("getStudentsInClass called with classId:", classId);
    
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        console.error("Invalid class ID received:", classId);
        throw new ApiError(status.BAD_REQUEST, `Invalid class ID: "${classId}". Expected a valid MongoDB ObjectId.`);
    }

    const classData = await Class.findById(classId)
        .populate("students.studentId", "firstName lastName email profile_image")
        .lean();

    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    console.log("Class data:", {
        classId: classData._id,
        totalStudents: classData.students.length,
        allStudents: classData.students.map(s => ({
            studentId: s.studentId?._id,
            status: s.status,
            hasStudentData: !!s.studentId
        }))
    });

    const activeStudents = classData.students.filter(s => s.status === 'active' && s.studentId);
    
    console.log("Active students count:", activeStudents.length);
    
    return activeStudents.map(s => ({
        _id: s.studentId._id,
        firstName: s.studentId.firstName || 'N/A',
        lastName: s.studentId.lastName || 'N/A',
        email: s.studentId.email,
        profile_image: s.studentId.profile_image
    }));
};


// const addAssignmentToClass = async (classId, data) => {
//     validateFields(data, ["assignmentId"]);

//     if (!mongoose.Types.ObjectId.isValid(classId)) {
//         throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const classData = await Class.findById(classId).session(session);
//         if (!classData) {
//             throw new ApiError(status.NOT_FOUND, "Class not found");
//         }

//         const assignment = await Assignment.findById(data.assignmentId).session(session);
//         if (!assignment) {
//             throw new ApiError(status.NOT_FOUND, "Assignment not found");
//         }

//         // Check if assignment is already in class
//         const existingAssignment = classData.assignments.find(
//             a => a.assignmentId.toString() === data.assignmentId && a.status === 'active'
//         );

//         if (existingAssignment) {
//             throw new ApiError(status.BAD_REQUEST, "Assignment is already in this class");
//         }

//         // Add assignment to class
//         classData.assignments.push({
//             assignmentId: data.assignmentId,
//             dueDate: data.dueDate,
//             status: 'active'
//         });

//         await classData.save({ session });

//         // Assign this assignment to all active students in the class
//         const activeStudents = classData.students.filter(s => s.status === 'active');

//         for (const student of activeStudents) {
//             const studentAssignment = new StudentAssignment({
//                 studentId: student.studentId,
//                 assignmentId: data.assignmentId,
//                 classId: classId,
//                 status: "not_started"
//             });
//             await studentAssignment.save({ session });
//         }

//         await session.commitTransaction();

//         return await Class.findById(classId)
//             .populate("students.studentId", "firstName lastName email")
//             .populate("assignments.assignmentId", "title assignmentCode");
//     } catch (error) {
//         await session.abortTransaction();
//         throw error;
//     } finally {
//         session.endSession();
//     }
// };

const addAssignmentToClass = async (classId, data) => {
    validateFields(data, ["assignmentId"]);

    console.log("addAssignmentToClass called with classId:", classId);
    console.log("addAssignmentToClass called with data:", data);
    const [classData, assignment] = await Promise.all([
        Class.findById(classId),
        Assignment.findById(data.assignmentId)
    ]);

    if (!classData || !assignment) {
        throw new ApiError(status.NOT_FOUND, "Class or Assignment not found");
    }

    // Single update operation for assignment
    const updatedAssignment = await Assignment.findByIdAndUpdate(
        data.assignmentId,
        { $addToSet: { classId: classId } }, // Prevents duplicates
        { new: true }
    );

    // Single update operation for class
    await Class.findByIdAndUpdate(
        classId,
        {
            $addToSet: {
                assignments: {
                    assignmentId: data.assignmentId,
                    dueDate: assignment.dueDate,
                    status: 'active'
                }
            }
        }
    );

    // Bulk create student assignments
    const activeStudents = classData.students.filter(s => s.status === 'active');
    const studentAssignments = activeStudents.map(student => ({
        studentId: student.studentId,
        assignmentId: data.assignmentId,
        classId: classId,
        status: "not_started"
    }));

    if (studentAssignments.length > 0) {
        await StudentAssignment.insertMany(studentAssignments, { ordered: false });
    }

    // Send notifications to all active students about the new assignment
    try {
        const activeStudents = classData.students.filter(s => s.status === 'active');
        for (const student of activeStudents) {
            await postNotification(
                "New Assignment Posted",
                `A new assignment "${assignment.title}" has been posted to your class "${classData.name}". Due date: ${assignment.dueDate || 'No due date set'}.`,
                student.studentId
            );
        }
    } catch (notificationError) {
        console.error("Failed to send assignment notifications:", notificationError);
    }

    return updatedAssignment;
};

// const removeAssignmentFromClass = async (classId, data) => {
//     validateFields(data, ["assignmentId"]);

//     if (!mongoose.Types.ObjectId.isValid(classId)) {
//         throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const classData = await Class.findById(classId).session(session);
//         if (!classData) {
//             throw new ApiError(status.NOT_FOUND, "Class not found");
//         }

//         // Remove assignment from class (soft delete)
//         const assignmentIndex = classData.assignments.findIndex(
//             a => a.assignmentId.toString() === data.assignmentId && a.status === 'active'
//         );

//         if (assignmentIndex === -1) {
//             throw new ApiError(status.NOT_FOUND, "Assignment not found in this class");
//         }

//         classData.assignments[assignmentIndex].status = 'inactive';
//         await classData.save({ session });

//         // Remove this assignment from all students in the class
//         await StudentAssignment.updateMany(
//             {
//                 assignmentId: data.assignmentId,
//                 classId: classId
//             },
//             { status: "inactive" },
//             { session }
//         );

//         await session.commitTransaction();

//         return await Class.findById(classId)
//             .populate("students.studentId", "firstName lastName email")
//             .populate("assignments.assignmentId", "title assignmentCode");
//     } catch (error) {
//         await session.abortTransaction();
//         throw error;
//     } finally {
//         session.endSession();
//     }
// };

// Assign assignment to specific students in a class
const assignAssignmentToStudents = async (classId, data) => {
    validateFields(data, ["assignmentId", "studentEmails"]);

    if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    // Verify class and assignment exist
    const [classData, assignment] = await Promise.all([
        Class.findById(classId).lean(),
        Assignment.findById(data.assignmentId).lean()
    ]);

    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    // Verify assignment is in the class
    const assignmentInClass = classData.assignments.find(
        a => a.assignmentId.toString() === data.assignmentId
    );

    if (!assignmentInClass) {
        throw new ApiError(status.BAD_REQUEST, "Assignment is not in this class");
    }

    // Find students by email
    const students = await Student.find({
        email: { $in: data.studentEmails }
    }).lean();

    if (students.length === 0) {
        throw new ApiError(status.NOT_FOUND, "No students found with provided emails");
    }

    console.log("Assigning to students:", {
        assignmentId: data.assignmentId,
        classId,
        studentCount: students.length,
        studentEmails: students.map(s => s.email)
    });

    // Verify students are in the class
    const classStudentIds = classData.students
        .filter(s => s.status === 'active')
        .map(s => s.studentId.toString());

    const validStudents = students.filter(student => 
        classStudentIds.includes(student._id.toString())
    );

    if (validStudents.length === 0) {
        throw new ApiError(status.BAD_REQUEST, "None of the students are active in this class");
    }

    // Check which students already have this assignment
    const existingAssignments = await StudentAssignment.find({
        assignmentId: data.assignmentId,
        studentId: { $in: validStudents.map(s => s._id) }
    }).lean();

    const existingStudentIds = new Set(
        existingAssignments.map(a => a.studentId.toString())
    );

    // Filter students who don't have the assignment yet
    const studentsToAssign = validStudents.filter(
        student => !existingStudentIds.has(student._id.toString())
    );

    const alreadyAssignedStudents = validStudents.filter(
        student => existingStudentIds.has(student._id.toString())
    );

    if (studentsToAssign.length === 0) {
        return {
            success: false,
            message: "All students already have this assignment",
            assignedCount: 0,
            alreadyAssignedCount: alreadyAssignedStudents.length,
            alreadyAssignedStudents: alreadyAssignedStudents.map(s => ({
                _id: s._id,
                email: s.email,
                firstName: s.firstName,
                lastName: s.lastName
            }))
        };
    }

    // Create student assignments for new students
    const studentAssignments = studentsToAssign.map(student => ({
        studentId: student._id,
        assignmentId: data.assignmentId,
        classId: classId,
        status: "not_started"
    }));

    const result = await StudentAssignment.insertMany(studentAssignments);

    // Send notifications to newly assigned students
    try {
        for (const student of studentsToAssign) {
            await postNotification(
                "New Assignment Assigned",
                `The assignment "${assignment.assignmentName}" has been assigned to you in class "${classData.name}". Due date: ${assignment.dueDate || 'No due date set'}.`,
                student._id
            );
        }
    } catch (notificationError) {
        console.error("Failed to send assignment notifications:", notificationError);
    }

    return {
        success: true,
        message: `Assignment assigned successfully to ${result.length} student(s)${alreadyAssignedStudents.length > 0 ? `, ${alreadyAssignedStudents.length} already had it` : ''}`,
        assignedCount: result.length,
        alreadyAssignedCount: alreadyAssignedStudents.length,
        newlyAssignedStudents: studentsToAssign.map(s => ({
            _id: s._id,
            email: s.email,
            firstName: s.firstName,
            lastName: s.lastName
        })),
        alreadyAssignedStudents: alreadyAssignedStudents.map(s => ({
            _id: s._id,
            email: s.email,
            firstName: s.firstName,
            lastName: s.lastName
        }))
    }
};

const getStudentsOfAssignment = async (classId, data) => {
    validateFields(data, ["assignmentId"]);

    const assignment = await Assignment.findById(data.assignmentId).populate('classId').lean();

    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    const classStudentIds = assignment.classId.students
        .filter(s => s.status === 'active')
        .map(s => s.studentId.toString());

    const students = await Student.find({
        _id: { $in: classStudentIds }
    }).lean();

    return {
        success: true,
        message: `Successfully retrieved ${students.length} students of this assignment`,
        students: students.map(student => ({
            _id: student._id,
            email: student.email,
            firstName: student.firstName,
            lastName: student.lastName
        }))
    };
};

const removeAssignmentFromClass = async (classId, data) => {
    validateFields(data, ["assignmentId"]);

    // Execute all operations in parallel without transaction
    const [assignmentResult, classResult, studentAssignmentResult] = await Promise.all([
        // Remove classId from assignment
        Assignment.updateOne(
            { _id: data.assignmentId },
            { $pull: { classId: classId } }
        ),
        // Remove assignment from class
        Class.updateOne(
            { _id: classId },
            { $pull: { assignments: { assignmentId: data.assignmentId } } }
        ),
        // Remove student assignments
        StudentAssignment.deleteMany({
            assignmentId: data.assignmentId,
            classId: classId
        })
    ]);

    // Check if assignment and class were found
    if (assignmentResult.matchedCount === 0 || classResult.matchedCount === 0) {
        throw new ApiError(status.NOT_FOUND, "Assignment or Class not found");
    }

    return {
        success: true,
        message: "Assignment removed from class successfully",
        removedStudentAssignments: studentAssignmentResult.deletedCount
    };
};

const getClassAssignments = async (classId) => {
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const classData = await Class.findById(classId)
        .populate("assignments.assignmentId", "assignmentName dueDate")
        .lean();

    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    // Clean up null assignment references (assignments that were deleted)
    const hasNullAssignments = classData.assignments.some(a => a.assignmentId === null);
    if (hasNullAssignments) {
        console.log("Cleaning up null assignment references for class:", classId);
        await Class.updateOne(
            { _id: classId },
            { $pull: { assignments: { assignmentId: null } } }
        );
    }

    // Get assignment statistics (filter out null/deleted assignments)
    const assignmentsWithStats = await Promise.all(
        classData.assignments
            .filter(a => a.status === 'active' && a.assignmentId !== null)
            .map(async (assignment) => {
                const stats = await StudentAssignment.aggregate([
                    {
                        $match: {
                            assignmentId: assignment.assignmentId._id,
                            classId: classId,
                            status: { $ne: "inactive" }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalStudents: { $sum: 1 },
                            submittedCount: {
                                $sum: { $cond: [{ $in: ["$status", ["submitted", "graded"]] }, 1, 0] }
                            },
                            averageScore: { $avg: "$totalMarksObtained" }
                        }
                    }
                ]);

                const stat = stats[0] || { totalStudents: 0, submittedCount: 0, averageScore: 0 };

                return {
                    ...assignment,
                    totalStudents: stat.totalStudents,
                    submittedCount: stat.submittedCount,
                    completionRate: stat.totalStudents > 0 ? Math.round((stat.submittedCount / stat.totalStudents) * 100) : 0,
                    averageScore: Math.round(stat.averageScore * 100) / 100
                };
            })
    );

    return assignmentsWithStats;
};

const getAssignmentDetails = async (classId, assignmentId) => {
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class or assignment ID");
    }

    const assignment = await Assignment.findById(assignmentId)
        .populate("questions")
        .lean();

    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    // Get student submissions for this assignment
    const studentSubmissions = await StudentAssignment.find({
        assignmentId: assignmentId,
        classId: classId,
        status: { $ne: "inactive" }
    })
        .populate("studentId", "firstName lastName email profile_image")
        .lean();

    // Calculate overall statistics
    const totalStudents = studentSubmissions.length;
    const submittedCount = studentSubmissions.filter(s =>
        ["submitted", "graded"].includes(s.status)
    ).length;
    const averageScore = studentSubmissions.length > 0
        ? studentSubmissions.reduce((sum, s) => sum + s.totalMarksObtained, 0) / studentSubmissions.length
        : 0;

    return {
        assignment,
        statistics: {
            totalStudents,
            submittedCount,
            completionRate: totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0,
            averageScore: Math.round(averageScore * 100) / 100
        },
        studentSubmissions: studentSubmissions.map(submission => ({
            student: submission.studentId,
            status: submission.status,
            marksObtained: submission.totalMarksObtained,
            completionRate: submission.completionRate,
            submittedAt: submission.submittedAt,
            startedAt: submission.startedAt
        }))
    };
};

const getAllAssignmentsByTeacherId = async (teacherId) => {
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid teacher ID");
    }

    const assignments = await Assignment.find({ teacherId: teacherId })
        .populate("questions")
        .lean();

    return assignments;
};

const createAssignment = async (req) => {
    const { body: data, user } = req;
    validateFields(data, ["assignmentName", "dueDate"]);

    const assignment = await Assignment.create({
        assignmentName: data.assignmentName,
        dueDate: data.dueDate,
        teacherId: user.authId,
        questions: [],
        classId: []
    });

    return assignment;
};

const getQuestionsByCurriculumAndTopic = async (query) => {
    validateFields(query, ["curriculumId", "topicId"]);

    const { curriculumId, topicId, search } = query;

    // Check if curriculum exists
    const curriculum = await Curriculum.findOne({
        _id: curriculumId,
        isActive: true,
    });
    if (!curriculum) {
        throw new ApiError(status.NOT_FOUND, "Curriculum not found");
    }

    // Check if topic exists and belongs to curriculum
    const topic = await Topic.findOne({
        _id: topicId,
        curriculumId: curriculumId,
        isActive: true,
    });
    if (!topic) {
        throw new ApiError(status.NOT_FOUND, "Topic not found in the selected curriculum");
    }

    // Build query for questions
    let questionQuery = {
        topicId: topicId,
        isActive: true,
    };

    // Add search functionality
    if (search) {
        questionQuery.$or = [
            { questionText: { $regex: search, $options: 'i' } }
        ];
    }

    const questions = await Question.find(questionQuery)
        .select("questionText questionImage attachments partialMarks fullMarks")
        .sort({ createdAt: -1 })
        .lean();

    return {
        curriculum: {
            _id: curriculum._id,
            name: curriculum.name,
        },
        topic: {
            _id: topic._id,
            name: topic.name,
        },
        questions,
    };
};


const getAssignmentById = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
    }

    const assignment = await Assignment.findById(id)
        .populate("curriculumId", "name")
        .populate("topicId", "name")
        .populate("questions")
        .lean();

    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    return assignment;
};

const getMyAssignments = async (userData, query) => {
    const assignmentQuery = new QueryBuilder(
        Assignment.find({ teacherId: userData.authId, isActive: true })
            .populate("curriculumId", "name")
            .populate("topicId", "name")
            .populate("questions", "questionText questionImage attachments partialMarks fullMarks")
            .lean(),
        query
    )
        .search(["title", "description", "assignmentCode"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const [assignments, meta] = await Promise.all([
        assignmentQuery.modelQuery,
        assignmentQuery.countTotal(),
    ]);

    return {
        meta,
        assignments,
    };
};

const updateAssignment = async (id, data) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
    }

    const assignment = await Assignment.findByIdAndUpdate(
        id,
        { ...data },
        { new: true, runValidators: true }
    )
        .populate("curriculumId", "name")
        .populate("topicId", "name")
        .populate("questions", "questionText questionImage attachments partialMarks fullMarks");

    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    return assignment;
};

const deleteAssignment = async (id) => {
    console.log(id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // First check if assignment exists
        const assignment = await Assignment.findById(id).session(session);
        if (!assignment) {
            throw new ApiError(status.NOT_FOUND, "Assignment not found");
        }

        console.log("Deleting assignment:", {
            assignmentId: id,
            assignmentName: assignment.assignmentName,
            teacherId: assignment.teacherId
        });

        // Remove assignment from all classes
        const classResult = await Class.updateMany(
            { "assignments.assignmentId": id },
            { $pull: { assignments: { assignmentId: id } } },
            { session }
        );

        // Remove all student assignments for this assignment
        const studentAssignmentResult = await StudentAssignment.deleteMany(
            { assignmentId: id },
            { session }
        );

        // Finally delete the assignment itself
        const deletedAssignment = await Assignment.findByIdAndDelete(id, { session });

        console.log("Assignment deletion results:", {
            classesUpdated: classResult.modifiedCount,
            studentAssignmentsDeleted: studentAssignmentResult.deletedCount,
            assignmentDeleted: !!deletedAssignment
        });

        await session.commitTransaction();

        return {
            success: true,
            message: "Assignment deleted successfully from all classes",
            assignment: deletedAssignment,
            affectedClasses: classResult.modifiedCount,
            deletedStudentAssignments: studentAssignmentResult.deletedCount
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// const addQuestionsToAssignment = async (assignmentId, data) => {
//     validateFields(data, ["questionIds"]);

//     if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
//         throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
//     }

//     const assignment = await Assignment.findById(assignmentId);
//     if (!assignment) {
//         throw new ApiError(status.NOT_FOUND, "Assignment not found");
//     }

//     // Get the questions and verify they belong to the same topic
//     const questions = await Question.find({
//         _id: { $in: data.questionIds },
//         topicId: assignment.topicId,
//         isActive: true,
//     });

//     if (questions.length !== data.questionIds.length) {
//         throw new ApiError(status.BAD_REQUEST, "Some questions are not valid or don't belong to the assignment's topic");
//     }

//     // Add new questions (avoid duplicates)
//     const newQuestionIds = data.questionIds.filter(
//         id => !assignment.questions.includes(id)
//     );

//     if (newQuestionIds.length > 0) {
//         assignment.questions.push(...newQuestionIds);
//         await assignment.save();
//     }

//     return await assignment.populate([
//         { path: "classId", select: "name classCode" },
//         { path: "curriculumId", select: "name" },
//         { path: "topicId", select: "name" },
//         { path: "questions", select: "questionText questionImage partialMarks fullMarks" }
//     ]);
// };

const addQuestionsToAssignment = async (assignmentId, data) => {
    validateFields(data, ["questionIds"]);

    // Single atomic operation - MongoDB will ignore non-existent IDs
    const updatedAssignment = await Assignment.findByIdAndUpdate(
        assignmentId,
        { 
            $addToSet: { 
                questions: { $each: data.questionIds } 
            } 
        },
        { new: true }
    ).populate("questions", "questionText questionImage attachments partialMarks fullMarks");

    if (!updatedAssignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    return updatedAssignment;
};

// const removeQuestionsFromAssignment = async (assignmentId, data) => {
//     validateFields(data, ["questionIds"]);

//     if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
//         throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
//     }

//     const assignment = await Assignment.findById(assignmentId);
//     if (!assignment) {
//         throw new ApiError(status.NOT_FOUND, "Assignment not found");
//     }

//     // Remove the questions
//     assignment.questions = assignment.questions.filter(
//         questionId => !data.questionIds.includes(questionId.toString())
//     );

//     // Recalculate total marks
//     const remainingQuestions = await Question.find({
//         _id: { $in: assignment.questions },
//     });

//     assignment.totalMarks = remainingQuestions.reduce((sum, question) => {
//         return sum + (question.fullMarks?.mark || 0);
//     }, 0);

//     await assignment.save();

//     return await assignment.populate([
//         { path: "curriculumId", select: "name" },
//         { path: "topicId", select: "name" },
//         { path: "questions", select: "questionText questionImage partialMarks fullMarks" }
//     ]);
// };

const removeQuestionsFromAssignment = async (assignmentId, data) => {
    validateFields(data, ["questionIds"]);

    // Fastest possible - just the update operation
    const result = await Assignment.updateOne(
        { _id: assignmentId },
        { 
            $pull: { 
                questions: { $in: data.questionIds } 
            } 
        }
    );

    if (result.matchedCount === 0) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    return { success: true, message: "Questions removed successfully" };
};

const ClassService = {
    createClass,
    getMyClasses,
    getClassById,
    updateClass,
    deleteClass,
    addStudentToClass,
    removeStudentFromClass,
    getStudentsInClass,
    addAssignmentToClass,
    assignAssignmentToStudents,
    removeAssignmentFromClass,
    getClassAssignments,
    getAssignmentDetails,
    getAllAssignmentsByTeacherId,
    //-----------------------------------
    createAssignment,
    getQuestionsByCurriculumAndTopic,
    getAssignmentById,
    getMyAssignments,
    updateAssignment,
    deleteAssignment,
    addQuestionsToAssignment,
    removeQuestionsFromAssignment,
    getStudentsOfAssignment

};

module.exports = ClassService;
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

    // Generate unique class code with retry mechanism
    const generateUniqueClassCode = async (maxRetries = 10) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Generate random 6-digit number
            const randomDigits = Math.floor(100000 + Math.random() * 900000);
            const classCode = `T${randomDigits}`;
            
            // Check if this code already exists (atomic check)
            const existingClass = await Class.findOne({ 
                classCode: classCode,
                isActive: true 
            }).lean();
            
            if (!existingClass) {
                return classCode;
            }
            
            // If code exists, try again
            console.log(`Class code ${classCode} already exists, retrying... (attempt ${attempt + 1})`);
        }
        
        throw new ApiError(status.INTERNAL_SERVER_ERROR, "Unable to generate unique class code after multiple attempts");
    };

    const uniqueClassCode = await generateUniqueClassCode();

    const newClass = await Class.create({
        name: data.name,
        teacherId: user.authId,
        classCode: uniqueClassCode, // Set the unique code directly
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
        // Get class data before deletion for cleanup
        const classData = await Class.findById(id).session(session);
        if (!classData) {
            throw new ApiError(status.NOT_FOUND, "Class not found");
        }

        // 1. Remove all student assignments for this class (set to inactive)
        const studentAssignmentResult = await StudentAssignment.updateMany(
            { 
                classId: id,
                status: { $ne: "inactive" }
            },
            { 
                status: "inactive",
                unassignedAt: new Date()
            },
            { session }
        );

        // 2. Remove classId from all assignments that reference this class
        await Assignment.updateMany(
            { classId: id },
            { $pull: { classId: id } },
            { session }
        );

        // 3. Delete the class completely from database
        const deletedClass = await Class.findByIdAndDelete(id, { session });

        await session.commitTransaction();

        

        return {
            success: true,
            message: "Class deleted successfully and all associated data cleaned up",
            class: {
                _id: classData._id,
                name: classData.name,
                classCode: classData.classCode,
                teacherId: classData.teacherId
            },
            cleanupStats: {
                studentsRemoved: classData.students.filter(s => s.status === 'active').length,
                assignmentsRemoved: classData.assignments.filter(a => a.status === 'active').length,
                studentAssignmentsRemoved: studentAssignmentResult.modifiedCount
            }
        };

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

        // console.log("student", student)

        if (!student) {
            throw new ApiError(status.NOT_FOUND, "Student not found");
        }

        // Check if student is already in class (including inactive students)
        const existingStudent = classData.students.find(
            s => s.studentId.toString() === student._id.toString()
        );

        // console.log("Adding student to class:", {
        //     classId,
        //     studentId: student._id,
        //     studentEmail: data.studentEmail,
        //     existingStudent: existingStudent ? {
        //         studentId: existingStudent.studentId,
        //         status: existingStudent.status
        //     } : null
        // });

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


const removeStudentFromClass = async (classId, data) => {
    validateFields(data, ["studentEmail"]);

    // Find student by email
    const student = await Student.findOne({ 
        email: data.studentEmail
    });

    if (!student) {
        throw new ApiError(status.NOT_FOUND, "Student not found");
    }

    // console.log("Removing student:", {
    //     classId,
    //     studentId: student._id,
    //     studentEmail: data.studentEmail
    // });

    // First check current status
    const classBefore = await Class.findById(classId);
    if (!classBefore) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    const currentStudentStatus = classBefore.students.find(
        s => s.studentId.toString() === student._id.toString()
    );
    
    // console.log("Current student status in class:", currentStudentStatus);

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

    // console.log("Update results:", {
    //     classMatchedCount: classResult.matchedCount,
    //     classModifiedCount: classResult.modifiedCount,
    //     assignmentsUpdated: assignmentResult.modifiedCount
    // });

    if (classResult.matchedCount === 0) {
        throw new ApiError(status.NOT_FOUND, "Student not found in this class");
    }

    // Verify the update worked
    const classAfter = await Class.findById(classId);
    const updatedStatus = classAfter.students.find(
        s => s.studentId.toString() === student._id.toString()
    );
    
    // console.log("Updated student status:", updatedStatus);

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
    // console.log("getStudentsInClass called with classId:", classId);
    
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        // console.error("Invalid class ID received:", classId);
        throw new ApiError(status.BAD_REQUEST, `Invalid class ID: "${classId}". Expected a valid MongoDB ObjectId.`);
    }

    const classData = await Class.findById(classId)
        .populate("students.studentId", "firstName lastName email profile_image")
        .lean();

    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    // console.log("Class data:", {
    //     classId: classData._id,
    //     totalStudents: classData.students.length,
    //     allStudents: classData.students.map(s => ({
    //         studentId: s.studentId?._id,
    //         status: s.status,
    //         hasStudentData: !!s.studentId
    //     }))
    // });

    const activeStudents = classData.students.filter(s => s.status === 'active' && s.studentId);
    
    // console.log("Active students count:", activeStudents.length);
    
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

    
    const [classData, assignment] = await Promise.all([
        Class.findById(classId),
        Assignment.findById(data.assignmentId)
    ]);

    // console.log("addAssignmentToClass called with classId:", classId);
    // console.log("addAssignmentToClass called with data:", data);

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

    // console.log("Assigning to students:", {
    //     assignmentId: data.assignmentId,
    //     classId,
    //     studentCount: students.length,
    //     studentEmails: students.map(s => s.email)
    // });

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

    // Check which students already have this assignment (both active and inactive)
    const allExistingAssignments = await StudentAssignment.find({
        assignmentId: data.assignmentId,
        studentId: { $in: validStudents.map(s => s._id) }
    }).lean();

    const existingActiveStudentIds = new Set(
        allExistingAssignments
            .filter(a => a.status !== "inactive")
            .map(a => a.studentId.toString())
    );

    const existingInactiveStudentIds = new Set(
        allExistingAssignments
            .filter(a => a.status === "inactive")
            .map(a => a.studentId.toString())
    );

    // Filter students who don't have the assignment yet
    const studentsToAssignNew = validStudents.filter(
        student => !existingActiveStudentIds.has(student._id.toString()) && !existingInactiveStudentIds.has(student._id.toString())
    );

    // Filter students who have inactive assignments (need to reactivate)
    const studentsToReactivate = validStudents.filter(
        student => existingInactiveStudentIds.has(student._id.toString())
    );

    const alreadyAssignedStudents = validStudents.filter(
        student => existingActiveStudentIds.has(student._id.toString())
    );

    if (studentsToAssignNew.length === 0 && studentsToReactivate.length === 0) {
        return {
            success: false,
            message: "All students already have this assignment",
            assignedCount: 0,
            reactivatedCount: 0,
            alreadyAssignedCount: alreadyAssignedStudents.length,
            alreadyAssignedStudents: alreadyAssignedStudents.map(s => ({
                _id: s._id,
                email: s.email,
                firstName: s.firstName,
                lastName: s.lastName
            }))
        };
    }

    let newAssignmentsResult = [];
    let reactivatedAssignmentsResult = [];

    // Create new student assignments for students who never had it
    if (studentsToAssignNew.length > 0) {
        const studentAssignments = studentsToAssignNew.map(student => ({
            studentId: student._id,
            assignmentId: data.assignmentId,
            classId: classId,
            status: "not_started"
        }));

        newAssignmentsResult = await StudentAssignment.insertMany(studentAssignments);
    }

    // Reactivate inactive assignments
    if (studentsToReactivate.length > 0) {
        const reactivationResult = await StudentAssignment.updateMany(
            {
                assignmentId: data.assignmentId,
                studentId: { $in: studentsToReactivate.map(s => s._id) },
                status: "inactive"
            },
            {
                status: "not_started",
                reactivatedAt: new Date(),
                $unset: {
                    unassignedAt: 1,
                    submittedAt: 1,
                    gradedAt: 1,
                    totalMarksObtained: 1,
                    completionRate: 1,
                    answers: 1
                }
            }
        );
        reactivatedAssignmentsResult = studentsToReactivate;
    }

    const allNewlyAssignedStudents = [...studentsToAssignNew, ...studentsToReactivate];

    // Send notifications to newly assigned and reactivated students
    try {
        for (const student of allNewlyAssignedStudents) {
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
        message: `Assignment assigned successfully to ${newAssignmentsResult.length + reactivatedAssignmentsResult.length} student(s)${alreadyAssignedStudents.length > 0 ? `, ${alreadyAssignedStudents.length} already had it` : ''}`,
        assignedCount: newAssignmentsResult.length,
        reactivatedCount: reactivatedAssignmentsResult.length,
        alreadyAssignedCount: alreadyAssignedStudents.length,
        newlyAssignedStudents: studentsToAssignNew.map(s => ({
            _id: s._id,
            email: s.email,
            firstName: s.firstName,
            lastName: s.lastName
        })),
        reactivatedStudents: studentsToReactivate.map(s => ({
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

//new api
const getStudentsOfAssignment = async (classId, assignmentId) => {
    // Check if the assignment exists in this class
    const classData = await Class.findById(classId).lean();
    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    const assignmentExists = classData.assignments.some(
        assignment => assignment.assignmentId.toString() === assignmentId && assignment.status === 'active'
    );

    if (!assignmentExists) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found in this class");
    }

    // Get students who actually have this assignment assigned (only active assignments)
    const studentAssignments = await StudentAssignment.find({
        assignmentId,
        classId,
        status: { $ne: "inactive" }  // Only show active assignments
    })
    .populate({
        path: 'studentId',
        select: 'firstName lastName email profile_image'
    })
    .lean();

    // Get active students from the class who have this assignment
    const classActiveStudentIds = classData.students
        .filter(s => s.status === 'active')
        .map(s => s.studentId.toString());

    const assignedStudents = studentAssignments.filter(sa => 
        classActiveStudentIds.includes(sa.studentId._id.toString())
    );

    return {
        success: true,
        message: `Successfully retrieved ${assignedStudents.length} students assigned to this assignment`,
        students: assignedStudents.map(studentAssignment => ({
            _id: studentAssignment.studentId._id,
            email: studentAssignment.studentId.email,
            firstName: studentAssignment.studentId.firstName,
            lastName: studentAssignment.studentId.lastName,
            profile_image: studentAssignment.studentId.profile_image,
            assignmentStatus: studentAssignment.status,
            totalMarksObtained: studentAssignment.totalMarksObtained || 0,
            completionRate: studentAssignment.completionRate || 0,
            startedAt: studentAssignment.startedAt,
            submittedAt: studentAssignment.submittedAt,
            gradedAt: studentAssignment.gradedAt
        }))
    };
};

// Get assignments assigned to a specific student in a class
const getStudentAssignmentsInClass = async (classId, studentId) => {
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(studentId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class or student ID");
    }

    // Verify class exists and student is in the class
    const classData = await Class.findById(classId).lean();
    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    const studentInClass = classData.students.find(
        s => s.studentId.toString() === studentId && s.status === 'active'
    );

    if (!studentInClass) {
        throw new ApiError(status.NOT_FOUND, "Student not found in this class");
    }

    // Get all student assignments for this student in this class
    const studentAssignments = await StudentAssignment.find({
        studentId: studentId,
        classId: classId,
        status: { $ne: "inactive" }
    })
    .populate({
        path: 'assignmentId',
        select: 'assignmentName description dueDate totalMarks duration curriculumId topicId',
        populate: [
            { path: 'curriculumId', select: 'name' },
            { path: 'topicId', select: 'name' }
        ]
    })
    .sort('-createdAt')
    .lean();

    // Filter out assignments where assignmentId is null (deleted)
    const validAssignments = studentAssignments.filter(sa => sa.assignmentId !== null);

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
        status: assignment.status || 'pending',
        totalMarksObtained: assignment.totalMarksObtained || 0,
        completionRate: assignment.completionRate || 0,
        startedAt: assignment.startedAt,
        submittedAt: assignment.submittedAt,
        gradedAt: assignment.gradedAt,
        createdAt: assignment.createdAt
    }));

    return {
        success: true,
        message: `Successfully retrieved ${formattedAssignments.length} assignments for student`,
        assignments: formattedAssignments
    };
};

// Get student's submitted answers for a specific assignment
const getStudentAssignmentSubmission = async (classId, studentId, assignmentId) => {
    if (!mongoose.Types.ObjectId.isValid(classId) || 
        !mongoose.Types.ObjectId.isValid(studentId) || 
        !mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid IDs provided");
    }

    // Verify class exists and student is in the class
    const classData = await Class.findById(classId).lean();
    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    const studentInClass = classData.students.find(
        s => s.studentId.toString() === studentId && s.status === 'active'
    );

    if (!studentInClass) {
        throw new ApiError(status.NOT_FOUND, "Student not found in this class");
    }

    // Find the student assignment by assignmentId
    const studentAssignment = await StudentAssignment.findOne({
        assignmentId: assignmentId,
        studentId: studentId,
        classId: classId,
        status: { $ne: "inactive" }  // Only show active assignments
    })
    .populate({
        path: 'assignmentId',
        populate: [
            { 
                path: 'questions',
                select: 'questionText questionImage partialMarks fullMarks attachments options correctAnswer'
            },
            { path: 'curriculumId', select: 'name' },
            { path: 'topicId', select: 'name' }
        ]
    })
    .lean();

    if (!studentAssignment) {
        throw new ApiError(status.NOT_FOUND, "Student assignment not found or has been removed");
    }

    if (!studentAssignment.assignmentId) {
        throw new ApiError(status.NOT_FOUND, "Assignment has been deleted");
    }

    // Format questions with student answers
    const questionsWithAnswers = (studentAssignment.assignmentId.questions && Array.isArray(studentAssignment.assignmentId.questions))
        ? studentAssignment.assignmentId.questions.map(question => {
            // Check if answers array exists and has content
            const studentAnswer = studentAssignment.answers && Array.isArray(studentAssignment.answers)
                ? studentAssignment.answers.find(
                    answer => answer.questionId.toString() === question._id.toString()
                )
                : null;

            return {
                _id: question._id,
                questionText: question.questionText,
                questionImage: question.questionImage,
                attachments: question.attachments,
                options: question.options,
                partialMarks: question.partialMarks,
                fullMarks: question.fullMarks,
                studentAnswer: studentAnswer || null,
                isCorrect: studentAnswer ? studentAnswer.isCorrect : null,
                marksObtained: studentAnswer ? studentAnswer.marksObtained : 0
            };
        })
        : [];

    return {
        _id: studentAssignment._id,
        assignment: {
            _id: studentAssignment.assignmentId._id,
            name: studentAssignment.assignmentId.assignmentName,
            description: studentAssignment.assignmentId.description,
            dueDate: studentAssignment.assignmentId.dueDate,
            totalMarks: studentAssignment.assignmentId.totalMarks,
            curriculum: studentAssignment.assignmentId.curriculumId?.name || 'General',
            topic: studentAssignment.assignmentId.topicId?.name || 'General Topic'
        },
        student: {
            _id: studentId,
            name: `${studentInClass.studentId?.firstName || ''} ${studentInClass.studentId?.lastName || ''}`.trim()
        },
        status: studentAssignment.status,
        totalMarksObtained: studentAssignment.totalMarksObtained || 0,
        completionRate: studentAssignment.completionRate || 0,
        startedAt: studentAssignment.startedAt,
        submittedAt: studentAssignment.submittedAt,
        gradedAt: studentAssignment.gradedAt,
        questions: questionsWithAnswers
    };
};

// Remove assignment from specific student
const removeAssignmentFromStudent = async (classId, studentId, data) => {
    validateFields(data, ["assignmentId"]);

    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(studentId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class or student ID");
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Verify class exists and teacher owns it
        const classData = await Class.findById(classId).session(session);
        if (!classData) {
            throw new ApiError(status.NOT_FOUND, "Class not found");
        }

        // Verify student is in the class
        const studentInClass = classData.students.find(
            s => s.studentId.toString() === studentId && s.status === 'active'
        );

        if (!studentInClass) {
            throw new ApiError(status.NOT_FOUND, "Student not found in this class");
        }

        // Find and update the student assignment status to inactive by assignmentId
        const studentAssignment = await StudentAssignment.findOneAndUpdate(
            {
                assignmentId: data.assignmentId,
                studentId: studentId,
                classId: classId,
                status: { $ne: "inactive" }
            },
            { 
                status: "inactive",
                unassignedAt: new Date()
            },
            { 
                new: true,
                session: session 
            }
        ).populate('assignmentId', 'assignmentName');

        if (!studentAssignment) {
            throw new ApiError(status.NOT_FOUND, "Student assignment not found or already removed");
        }

        await session.commitTransaction();

        return {
            success: true,
            message: `Assignment "${studentAssignment.assignmentId.assignmentName}" successfully removed from student`,
            removedAssignment: {
                studentAssignmentId: studentAssignment._id,
                assignmentId: studentAssignment.assignmentId._id,
                assignmentName: studentAssignment.assignmentId.assignmentName,
                studentId: studentId,
                classId: classId,
                unassignedAt: studentAssignment.unassignedAt
            }
        };

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
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
        // console.log("Cleaning up null assignment references for class:", classId);
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
    // console.log(id);
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

        // console.log("Deleting assignment:", {
        //     assignmentId: id,
        //     assignmentName: assignment.assignmentName,
        //     teacherId: assignment.teacherId
        // });

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

        // console.log("Assignment deletion results:", {
        //     classesUpdated: classResult.modifiedCount,
        //     studentAssignmentsDeleted: studentAssignmentResult.deletedCount,
        //     assignmentDeleted: !!deletedAssignment
        // });

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
    getStudentsOfAssignment,
    getStudentAssignmentSubmission,
    getStudentAssignmentsInClass,
    removeAssignmentFromStudent
};

module.exports = ClassService;
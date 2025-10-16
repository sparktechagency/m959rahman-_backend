const { status } = require("http-status");
const mongoose = require("mongoose");

const ApiError = require("../../../error/ApiError");
const Class = require("../../module/class/Class");
const Assignment = require("../../module/class/Assignment");
const StudentAssignment = require("../../module/class/StudentAssignment");
const Auth = require("../../module/auth/Auth");
const validateFields = require("../../../util/validateFields");
const QueryBuilder = require("../../../builder/queryBuilder");
const Curriculum = require("../../module/curriculum/Curriculum");
const Topic = require("../../module/curriculum/Topic");
const Question = require("../../module/curriculum/Question");

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
            .populate("students.studentId", "name email")
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
        .populate("students.studentId", "name email profile_image")
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
        .populate("students.studentId", "name email")
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
        const student = await Auth.findOne({
            email: data.studentEmail,
            role: 'STUDENT'
        }).session(session);

        if (!student) {
            throw new ApiError(status.NOT_FOUND, "Student not found");
        }

        // Check if student is already in class
        const existingStudent = classData.students.find(
            s => s.studentId.toString() === student._id.toString() && s.status === 'active'
        );

        if (existingStudent) {
            throw new ApiError(status.BAD_REQUEST, "Student is already in this class");
        }

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

        return await Class.findById(classId)
            .populate("students.studentId", "name email")
            .populate("assignments.assignmentId", "title assignmentCode");
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const removeStudentFromClass = async (classId, data) => {
    validateFields(data, ["studentId"]);

    if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const classData = await Class.findById(classId).session(session);
        if (!classData) {
            throw new ApiError(status.NOT_FOUND, "Class not found");
        }

        // Remove student from class (soft delete)
        const studentIndex = classData.students.findIndex(
            s => s.studentId.toString() === data.studentId && s.status === 'active'
        );

        if (studentIndex === -1) {
            throw new ApiError(status.NOT_FOUND, "Student not found in this class");
        }

        classData.students[studentIndex].status = 'inactive';
        await classData.save({ session });

        // Remove student assignments for this class
        await StudentAssignment.updateMany(
            {
                studentId: data.studentId,
                classId: classId
            },
            { status: "inactive" },
            { session }
        );

        await session.commitTransaction();

        return await Class.findById(classId)
            .populate("students.studentId", "name email")
            .populate("assignments.assignmentId", "title assignmentCode");
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};


const getStudentsInClass = async (classId) => {
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const classData = await Class.findById(classId)
        .populate("students.studentId", "name email profile_image")
        .lean();

    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    const activeStudents = classData.students.filter(s => s.status === 'active');

    return activeStudents.map(s => ({
        name: s.studentId.name,
        email: s.studentId.email,
        profile_image: s.studentId.profile_image
    }));
};


const addAssignmentToClass = async (classId, data) => {
    validateFields(data, ["assignmentId"]);

    if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const classData = await Class.findById(classId).session(session);
        if (!classData) {
            throw new ApiError(status.NOT_FOUND, "Class not found");
        }

        const assignment = await Assignment.findById(data.assignmentId).session(session);
        if (!assignment) {
            throw new ApiError(status.NOT_FOUND, "Assignment not found");
        }

        // Check if assignment is already in class
        const existingAssignment = classData.assignments.find(
            a => a.assignmentId.toString() === data.assignmentId && a.status === 'active'
        );

        if (existingAssignment) {
            throw new ApiError(status.BAD_REQUEST, "Assignment is already in this class");
        }

        // Add assignment to class
        classData.assignments.push({
            assignmentId: data.assignmentId,
            dueDate: data.dueDate,
            status: 'active'
        });

        await classData.save({ session });

        // Assign this assignment to all active students in the class
        const activeStudents = classData.students.filter(s => s.status === 'active');

        for (const student of activeStudents) {
            const studentAssignment = new StudentAssignment({
                studentId: student.studentId,
                assignmentId: data.assignmentId,
                classId: classId,
                status: "not_started"
            });
            await studentAssignment.save({ session });
        }

        await session.commitTransaction();

        return await Class.findById(classId)
            .populate("students.studentId", "name email")
            .populate("assignments.assignmentId", "title assignmentCode");
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const removeAssignmentFromClass = async (classId, data) => {
    validateFields(data, ["assignmentId"]);

    if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const classData = await Class.findById(classId).session(session);
        if (!classData) {
            throw new ApiError(status.NOT_FOUND, "Class not found");
        }

        // Remove assignment from class (soft delete)
        const assignmentIndex = classData.assignments.findIndex(
            a => a.assignmentId.toString() === data.assignmentId && a.status === 'active'
        );

        if (assignmentIndex === -1) {
            throw new ApiError(status.NOT_FOUND, "Assignment not found in this class");
        }

        classData.assignments[assignmentIndex].status = 'inactive';
        await classData.save({ session });

        // Remove this assignment from all students in the class
        await StudentAssignment.updateMany(
            {
                assignmentId: data.assignmentId,
                classId: classId
            },
            { status: "inactive" },
            { session }
        );

        await session.commitTransaction();

        return await Class.findById(classId)
            .populate("students.studentId", "name email")
            .populate("assignments.assignmentId", "title assignmentCode");
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getClassAssignments = async (classId) => {
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid class ID");
    }

    const classData = await Class.findById(classId)
        .populate("assignments.assignmentId", "title assignmentCode description totalMarks duration")
        .lean();

    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found");
    }

    // Get assignment statistics
    const assignmentsWithStats = await Promise.all(
        classData.assignments
            .filter(a => a.status === 'active')
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
        .populate("studentId", "name email profile_image")
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

//------------------------------------------------------------------------------

const createAssignment = async (req) => {
    const { body: data, user } = req;
    validateFields(data, ["assignmentName", "classId", "curriculumId", "topicId", "dueDate"]);

    // Check if class exists and belongs to teacher
    const classData = await Class.findOne({
        _id: data.classId,
        teacherId: user.authId,
        isActive: true,
    });
    if (!classData) {
        throw new ApiError(status.NOT_FOUND, "Class not found or you don't have permission");
    }

    // Check if curriculum exists
    const curriculum = await Curriculum.findOne({
        _id: data.curriculumId,
        isActive: true,
    });
    if (!curriculum) {
        throw new ApiError(status.NOT_FOUND, "Curriculum not found");
    }

    // Check if topic exists and belongs to the curriculum
    const topic = await Topic.findOne({
        _id: data.topicId,
        curriculumId: data.curriculumId,
        isActive: true,
    });
    if (!topic) {
        throw new ApiError(status.NOT_FOUND, "Topic not found in the selected curriculum");
    }

    // Validate questions if provided
    if (data.questions && data.questions.length > 0) {
        const questions = await Question.find({
            _id: { $in: data.questions },
            topicId: data.topicId,
            isActive: true,
        });

        if (questions.length !== data.questions.length) {
            throw new ApiError(status.BAD_REQUEST, "Some questions are not valid or don't belong to the selected topic");
        }
    }

    const assignmentData = {
        ...data,
        teacherId: user.authId,
        totalMarks: 0, // We'll calculate this later from questions
    };

    const assignment = await Assignment.create(assignmentData);
    
    // Add assignment to class
    classData.assignments.push({
        assignmentId: assignment._id,
        dueDate: data.dueDate || assignment.dueDate,
        status: 'active'
    });
    await classData.save();

    // Assign this assignment to all students in the class
    const activeStudents = classData.students.filter(s => s.status === 'active');
    const studentAssignmentPromises = activeStudents.map(student => 
        StudentAssignment.create({
            studentId: student.studentId,
            assignmentId: assignment._id,
            classId: data.classId,
            status: "not_started"
        })
    );
    
    await Promise.all(studentAssignmentPromises);

    return await assignment.populate([
        { path: "classId", select: "name classCode" },
        { path: "curriculumId", select: "name" },
        { path: "topicId", select: "name" },
        { path: "questions", select: "questionText questionImage partialMarks fullMarks" }
    ]);
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
        .select("questionText questionImage partialMarks fullMarks")
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
            .populate("questions", "questionText questionImage")
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
        .populate("questions", "questionText questionImage");

    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    return assignment;
};

const deleteAssignment = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
    }

    const assignment = await Assignment.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
    );

    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    return assignment;
};

const addQuestionsToAssignment = async (assignmentId, data) => {
    validateFields(data, ["questionIds"]);

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    // Get the questions and verify they belong to the same topic
    const questions = await Question.find({
        _id: { $in: data.questionIds },
        topicId: assignment.topicId,
        isActive: true,
    });

    if (questions.length !== data.questionIds.length) {
        throw new ApiError(status.BAD_REQUEST, "Some questions are not valid or don't belong to the assignment's topic");
    }

    // Add new questions (avoid duplicates)
    const newQuestionIds = data.questionIds.filter(
        id => !assignment.questions.includes(id)
    );

    if (newQuestionIds.length > 0) {
        assignment.questions.push(...newQuestionIds);
        await assignment.save();
    }

    return await assignment.populate([
        { path: "classId", select: "name classCode" },
        { path: "curriculumId", select: "name" },
        { path: "topicId", select: "name" },
        { path: "questions", select: "questionText questionImage partialMarks fullMarks" }
    ]);
};


const removeQuestionsFromAssignment = async (assignmentId, data) => {
    validateFields(data, ["questionIds"]);

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid assignment ID");
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
        throw new ApiError(status.NOT_FOUND, "Assignment not found");
    }

    // Remove the questions
    assignment.questions = assignment.questions.filter(
        questionId => !data.questionIds.includes(questionId.toString())
    );

    // Recalculate total marks
    const remainingQuestions = await Question.find({
        _id: { $in: assignment.questions },
    });

    assignment.totalMarks = remainingQuestions.reduce((sum, question) => {
        return sum + (question.fullMarks?.mark || 0);
    }, 0);

    await assignment.save();

    return await assignment.populate([
        { path: "curriculumId", select: "name" },
        { path: "topicId", select: "name" },
        { path: "questions", select: "questionText questionImage partialMarks fullMarks" }
    ]);
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
    removeAssignmentFromClass,
    getClassAssignments,
    getAssignmentDetails,
    //-----------------------------------
    createAssignment,
    getQuestionsByCurriculumAndTopic,
    getAssignmentById,
    getMyAssignments,
    updateAssignment,
    deleteAssignment,
    addQuestionsToAssignment,
    removeQuestionsFromAssignment,

};

module.exports = ClassService;
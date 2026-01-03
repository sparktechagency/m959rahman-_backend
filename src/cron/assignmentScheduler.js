const cron = require("node-cron");
const Assignment = require("../app/module/class/Assignment");
const Class = require("../app/module/class/Class");
const StudentAssignment = require("../app/module/class/StudentAssignment");
const postNotification = require("../util/postNotification");

/**
 * Cron job to publish scheduled assignments
 * Runs every minute to check for assignments that should be published
 */
const startAssignmentScheduler = () => {
    // Run every minute
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();

            // Find all assignments that are scheduled and should be published
            const scheduledAssignments = await Assignment.find({
                publishStatus: "scheduled",
                publishAt: { $lte: now },
            }).populate("classId");

            if (scheduledAssignments.length === 0) {
                return; // No assignments to publish
            }

            console.log(`[Assignment Scheduler] Found ${scheduledAssignments.length} assignments to publish`);

            for (const assignment of scheduledAssignments) {
                try {
                    // Update assignment status to published
                    assignment.publishStatus = "published";
                    await assignment.save();

                    console.log(`[Assignment Scheduler] Publishing assignment: ${assignment.assignmentName} (${assignment._id})`);

                    // For each class this assignment is assigned to
                    const classIds = assignment.classId || [];

                    for (const classId of classIds) {
                        // Get the class with students
                        const classData = await Class.findById(classId);

                        if (!classData) {
                            console.warn(`[Assignment Scheduler] Class ${classId} not found for assignment ${assignment._id}`);
                            continue;
                        }

                        // Get all active students in the class
                        const activeStudents = classData.students.filter(s => s.status === 'active');

                        // Create StudentAssignment records for students who don't have it yet
                        for (const student of activeStudents) {
                            const existingAssignment = await StudentAssignment.findOne({
                                studentId: student.studentId,
                                assignmentId: assignment._id,
                                classId: classId,
                            });

                            if (!existingAssignment) {
                                // Create new student assignment
                                await StudentAssignment.create({
                                    studentId: student.studentId,
                                    assignmentId: assignment._id,
                                    classId: classId,
                                    status: "not_started",
                                });

                                // Send notification to student
                                try {
                                    await postNotification(
                                        "New Assignment Posted",
                                        `A new assignment "${assignment.assignmentName}" has been posted to your class "${classData.name}". Due date: ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date set'}.`,
                                        student.studentId
                                    );
                                } catch (notificationError) {
                                    console.error(`[Assignment Scheduler] Failed to send notification to student ${student.studentId}:`, notificationError);
                                }
                            }
                        }

                        console.log(`[Assignment Scheduler] Assigned to ${activeStudents.length} students in class ${classData.name}`);
                    }

                    console.log(`[Assignment Scheduler] Successfully published assignment: ${assignment.assignmentName}`);
                } catch (assignmentError) {
                    console.error(`[Assignment Scheduler] Error publishing assignment ${assignment._id}:`, assignmentError);
                }
            }
        } catch (error) {
            console.error("[Assignment Scheduler] Error in cron job:", error);
        }
    });

    console.log("[Assignment Scheduler] Cron job started - runs every minute");
};

module.exports = startAssignmentScheduler;

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const StudentAssignmentSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    answers: [{
      questionId: {
        type: Schema.Types.ObjectId,
        ref: "Question",
        required: true,
      },
      answer: {
        type: String,
        trim: true,
      },
      marksObtained: {
        type: Number,
        default: 0,
      },
      submittedAt: {
        type: Date,
      }
    }],
    totalMarksObtained: {
      type: Number,
      default: 0,
    },
    completionRate: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "submitted", "graded"],
      default: "not_started",
    },
    startedAt: {
      type: Date,
    },
    submittedAt: {
      type: Date,
    },
    gradedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique assignment per student
StudentAssignmentSchema.index({ studentId: 1, assignmentId: 1 }, { unique: true });

const StudentAssignment = model("StudentAssignment", StudentAssignmentSchema);

module.exports = StudentAssignment;
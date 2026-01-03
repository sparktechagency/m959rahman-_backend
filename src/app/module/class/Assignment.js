const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const AssignmentSchema = new Schema(
  {
    assignmentName: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    questions: [{
      type: Schema.Types.ObjectId,
      ref: "Question",
    }],
    classId: [{
      type: Schema.Types.ObjectId,
      ref: "Class"
    }],
    curriculumId: {
      type: Schema.Types.ObjectId,
      ref: "Curriculum"
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic"
    },
    totalMarks: {
      type: Number,
    },
    duration: {
      type: Number, // in minutes
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    publishAt: {
      type: Date,
    },
    publishStatus: {
      type: String,
      enum: ["draft", "scheduled", "published"],
      default: "published",
    },
  },
  {
    timestamps: true,
  }
);

const Assignment = model("Assignment", AssignmentSchema);

module.exports = Assignment;
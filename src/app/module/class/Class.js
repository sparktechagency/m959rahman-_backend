const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const ClassSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    classCode: {
      type: String,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    students: [{
      studentId: {
        type: Schema.Types.ObjectId,
        ref: "Student"
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active",
      }
    }],
    assignments: [{
      assignmentId: {
        type: Schema.Types.ObjectId,
        ref: "Assignment",
      },
      assignedAt: {
        type: Date,
        default: Date.now,
      },
      dueDate: {
        type: Date,
      },
      status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active",
      }
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    maxStudents: {
      type: Number,
      default: 33,
    },
  },
  {
    timestamps: true,
  }
);

// Class code is now generated in the service layer to ensure uniqueness

const Class = model("Class", ClassSchema);

module.exports = Class;
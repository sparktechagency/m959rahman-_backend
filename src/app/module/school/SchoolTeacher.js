const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const SchoolTeacherSchema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "Auth"
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create a compound index to ensure a teacher can only be added once to a school
SchoolTeacherSchema.index({ schoolId: 1, teacherId: 1 }, { unique: true });

const SchoolTeacher = model("SchoolTeacher", SchoolTeacherSchema);

module.exports = SchoolTeacher;

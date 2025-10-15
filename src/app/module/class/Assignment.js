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
    assignmentCode: {
      type: String,
      unique: true,
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
    curriculumId: {
      type: Schema.Types.ObjectId,
      ref: "Curriculum",
      required: true,
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
    },
    questions: [{
      type: Schema.Types.ObjectId,
      ref: "Question",
    }],
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    totalMarks: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number, // in minutes
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save to generate assignment code
AssignmentSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Assignment').countDocuments();
    this.assignmentCode = `AS1-TA${count + 1}`;
  }
  next();
});

const Assignment = model("Assignment", AssignmentSchema);

module.exports = Assignment;
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

// Pre-save to generate class code
ClassSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Class').countDocuments();
    this.classCode = `T${(26590 + count + 1).toString().slice(-5)}`;
  }
  next();
});

const Class = model("Class", ClassSchema);

module.exports = Class;
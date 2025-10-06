const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CurriculumSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Curriculum = model("Curriculum", CurriculumSchema);

module.exports = Curriculum;
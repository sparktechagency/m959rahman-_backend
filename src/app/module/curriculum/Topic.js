const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const TopicSchema = new Schema(
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
    curriculumId: {
      type: Schema.Types.ObjectId,
      ref: "Curriculum",
      required: true,
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

const Topic = model("Topic", TopicSchema);

module.exports = Topic;
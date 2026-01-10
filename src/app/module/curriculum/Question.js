const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const PartialAnswerSchema = new Schema({
  mark: {
    type: Number,
    required: true,
  },
  answer: {
    type: String,
    required: true,
    trim: true,
  },
});

const FullAnswerSchema = new Schema({
  mark: {
    type: Number,
    required: true,
  },
  answer: {
    type: String,
    required: true,
    trim: true,
  },
});

const QuestionSchema = new Schema(
  {
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: [String],
    partialMarks: [PartialAnswerSchema],
    fullMarks: FullAnswerSchema,
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

const Question = model("Question", QuestionSchema);

module.exports = Question;
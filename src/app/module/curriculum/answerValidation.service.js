const { status } = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../../../error/ApiError");
const Question = require("./Question");
const StudentAssignment = require("../class/StudentAssignment");
const validateFields = require("../../../util/validateFields");

/**
 * Calculate similarity between two strings for partial matching
 * Uses Levenshtein distance algorithm
 */
const calculateStringSimilarity = (str1, str2) => {
  str1 = str1.toLowerCase().trim();
  str2 = str2.toLowerCase().trim();
  
  if (str1 === str2) return 1.0;
  
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return 0;
  if (len2 === 0) return 0;
  
  // Initialize matrix
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  // Calculate Levenshtein distance
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLength = Math.max(len1, len2);
  return (maxLength - distance) / maxLength;
};

/**
 * Check if student answer matches any partial answer options
 */
const checkPartialMarks = (studentAnswer, partialMarks) => {
  if (!partialMarks || !Array.isArray(partialMarks) || partialMarks.length === 0) {
    return { matched: false, marks: 0, similarity: 0 };
  }
  
  let bestMatch = { matched: false, marks: 0, similarity: 0 };
  
  for (const partialOption of partialMarks) {
    const similarity = calculateStringSimilarity(studentAnswer, partialOption.answer);
    
    // Consider it a match if similarity is 80% or higher
    if (similarity >= 0.8) {
      if (partialOption.marks > bestMatch.marks) {
        bestMatch = {
          matched: true,
          marks: partialOption.marks,
          similarity: similarity,
          matchedAnswer: partialOption.answer
        };
      }
    }
  }
  
  return bestMatch;
};

/**
 * Check if student answer matches the full marks answer
 */
const checkFullMarks = (studentAnswer, fullMarks) => {
  if (!fullMarks || !fullMarks.answer) {
    return { matched: false, marks: 0, similarity: 0 };
  }
  
  const similarity = calculateStringSimilarity(studentAnswer, fullMarks.answer);
  
  // For full marks, require 95% or higher similarity
  return {
    matched: similarity >= 0.95,
    marks: similarity >= 0.95 ? fullMarks.mark : 0,
    similarity: similarity,
    correctAnswer: fullMarks.answer
  };
};

/**
 * Validate a single answer and return the result
 */
const validateSingleAnswer = async (questionId, studentAnswer) => {
  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid question ID");
  }
  
  const question = await Question.findById(questionId);
  if (!question || !question.isActive) {
    throw new ApiError(status.NOT_FOUND, "Question not found");
  }
  
  const validationResult = {
    questionId,
    studentAnswer,
    correctAnswer: question.fullMarks?.answer || null,
    partialOptions: question.partialMarks || [],
    marksObtained: 0,
    validationType: null,
    similarity: 0,
    feedback: ""
  };
  
  // First check for full marks
  const fullMarksResult = checkFullMarks(studentAnswer, question.fullMarks);
  if (fullMarksResult.matched) {
    validationResult.marksObtained = fullMarksResult.marks;
    validationResult.validationType = "full_marks";
    validationResult.similarity = fullMarksResult.similarity;
    validationResult.feedback = `Excellent! Your answer matches ${Math.round(fullMarksResult.similarity * 100)}% with the correct answer.`;
    return validationResult;
  }
  
  // Then check for partial marks
  const partialMarksResult = checkPartialMarks(studentAnswer, question.partialMarks);
  if (partialMarksResult.matched) {
    validationResult.marksObtained = partialMarksResult.marks;
    validationResult.validationType = "partial_marks";
    validationResult.similarity = partialMarksResult.similarity;
    validationResult.feedback = `Good attempt! Your answer matches ${Math.round(partialMarksResult.similarity * 100)}% with "${partialMarksResult.matchedAnswer}". You earned partial marks.`;
    return validationResult;
  }
  
  // No match found
  validationResult.feedback = "Your answer does not match any of the expected answers. Please review the question and try again.";
  return validationResult;
};

/**
 * Validate multiple answers for an assignment
 */
const validateAssignmentAnswers = async (studentId, assignmentId, answers) => {
  const validationResults = [];
  let totalMarksObtained = 0;
  
  for (const answerData of answers) {
    try {
      const result = await validateSingleAnswer(answerData.questionId, answerData.answer);
      validationResults.push(result);
      totalMarksObtained += result.marksObtained;
    } catch (error) {
      validationResults.push({
        questionId: answerData.questionId,
        studentAnswer: answerData.answer,
        error: error.message,
        marksObtained: 0
      });
    }
  }
  
  return {
    studentId,
    assignmentId,
    validationResults,
    totalMarksObtained,
    totalQuestions: answers.length,
    validatedAt: new Date()
  };
};

/**
 * Submit and validate answers for a student assignment
 */
const submitAndValidateAnswers = async (req) => {
  const { body: data, user } = req;
  const { assignmentId, answers } = data;
  
  validateFields(data, ["assignmentId", "answers"]);
  
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new ApiError(status.BAD_REQUEST, "Answers array is required and cannot be empty");
  }
  
  // Validate each answer has required fields
  for (const answer of answers) {
    validateFields(answer, ["questionId", "answer"]);
  }
  
  // Get or create student assignment
  let studentAssignment = await StudentAssignment.findOne({
    studentId: user.userId,
    assignmentId
  });
  
  // console.log(studentAssignment.assignmentId);
  // console.log(assignmentId);

  
  if (!studentAssignment) {
    throw new ApiError(status.NOT_FOUND, "Student assignment not found");
  }
  
  // Validate all answers
  const validationResult = await validateAssignmentAnswers(user.userId, assignmentId, answers);
  
  // Update student assignment with validated answers
  const updatedAnswers = answers.map((answer, index) => {
    const validation = validationResult.validationResults[index];
    return {
      questionId: answer.questionId,
      answer: answer.answer,
      marksObtained: validation.marksObtained || 0,
      submittedAt: new Date()
    };
  });
  
  // Calculate completion rate
  const completionRate = (answers.length / validationResult.totalQuestions) * 100;
  
  // Update the assignment
  studentAssignment.answers = updatedAnswers;
  studentAssignment.totalMarksObtained = validationResult.totalMarksObtained;
  studentAssignment.completionRate = completionRate;
  studentAssignment.status = "graded";
  studentAssignment.submittedAt = new Date();
  studentAssignment.gradedAt = new Date();
  
  await studentAssignment.save();
  
  return {
    assignmentId,
    studentId: user.userId,
    validationResults: validationResult.validationResults,
    totalMarksObtained: validationResult.totalMarksObtained,
    completionRate: Math.round(completionRate),
    submittedAt: studentAssignment.submittedAt,
    gradedAt: studentAssignment.gradedAt
  };
};

/**
 * Get validation details for a specific question answer
 */
const getAnswerValidationDetails = async (questionId, studentAnswer) => {
  const result = await validateSingleAnswer(questionId, studentAnswer);
  
  // Get question details for context
  const question = await Question.findById(questionId)
    .populate("topicId", "name")
    .lean();
  
  return {
    question: {
      id: question._id,
      text: question.questionText,
      topic: question.topicId?.name,
      fullMarks: question.fullMarks,
      partialMarks: question.partialMarks
    },
    validation: result
  };
};

module.exports = {
  validateSingleAnswer,
  validateAssignmentAnswers,
  submitAndValidateAnswers,
  getAnswerValidationDetails,
  calculateStringSimilarity
};

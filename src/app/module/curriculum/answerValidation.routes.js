const router = require("express").Router();
const { AnswerValidationController } = require("./answerValidation.controller");
const auth = require("../../middleware/auth");

// Validate a single answer (for practice/testing)
router.post(
  "/validate-single",
  auth(),
  AnswerValidationController.validateSingleAnswer
);

// Submit and validate answers for an assignment
router.post(
  "/submit-assignment",
  auth(),
  AnswerValidationController.submitAndValidateAnswers
);

// Get detailed validation for a specific answer
router.get(
  "/validation-details",
  auth(),
  AnswerValidationController.getAnswerValidationDetails
);

// Test answer similarity (useful for admin to understand matching)
router.post(
  "/test-similarity",
  auth(),
  AnswerValidationController.testAnswerSimilarity
);

module.exports = router;

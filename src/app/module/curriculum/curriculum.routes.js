const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploaderS3");
const { CurriculumController } = require("./curriculum.controller");
const { AnswerValidationController } = require("./answerValidation.controller");
const config = require("../../../config");

const router = express.Router();



router
  .post("/topics", auth(config.auth_level.admin), CurriculumController.createTopic)
  .get("/topics", auth(config.auth_level.user), CurriculumController.getAllTopics) // NEW - Get all topics with pagination
  .get("/topics/:curriculumId", auth(config.auth_level.user), CurriculumController.getTopicsByCurriculum) // Existing - Get topics by curriculum
  .patch("/topics/:id", auth(config.auth_level.admin), CurriculumController.updateTopic)
  .delete("/topics/:id", auth(config.auth_level.admin), CurriculumController.deleteTopic);


// Curriculum routes
router.post("/", auth(config.auth_level.admin), CurriculumController.createCurriculum);
router.get("/", auth(config.auth_level.user), CurriculumController.getAllCurriculums);
router.get("/:id", auth(config.auth_level.user), CurriculumController.getCurriculum);
router.patch("/:id", auth(config.auth_level.admin), CurriculumController.updateCurriculum);
router.delete("/:id", auth(config.auth_level.admin), CurriculumController.deleteCurriculum);

// Topic routes - each on its own line to avoid chaining issues
// Topic routes

// Question routes
router.post(
  "/questions",
  auth(config.auth_level.admin),
  uploadFile([{ name: "attachments", maxCount: 3 }]),
  CurriculumController.createQuestion
);
router.get("/questions/:topicId", auth(config.auth_level.user), CurriculumController.getQuestionsByTopic);
router.get("/question/:id", auth(config.auth_level.user), CurriculumController.getQuestion);
router.patch(
  "/questions/:id",
  auth(config.auth_level.admin),
  uploadFile([{ name: "attachments", maxCount: 3 }]),
  CurriculumController.updateQuestion
);
router.delete("/questions/:id", auth(config.auth_level.admin), CurriculumController.deleteQuestion);

// Answer validation routes
router.post(
  "/answers/validate-single",
  auth(config.auth_level.user),
  AnswerValidationController.validateSingleAnswer
);
router.post(
  "/answers/submit-assignment",
  auth(config.auth_level.user),
  AnswerValidationController.submitAndValidateAnswers
);
router.get(
  "/answers/validation-details",
  auth(config.auth_level.user),
  AnswerValidationController.getAnswerValidationDetails
);
router.post(
  "/answers/test-similarity",
  auth(config.auth_level.admin),
  AnswerValidationController.testAnswerSimilarity
);

module.exports = router;
const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { CurriculumController } = require("./curriculum.controller");
const config = require("../../../config");

const router = express.Router();

// Curriculum routes
router.post("/", auth(config.auth_level.admin), CurriculumController.createCurriculum);
router.get("/", auth(config.auth_level.admin), CurriculumController.getAllCurriculums);
router.get("/:id", auth(config.auth_level.admin), CurriculumController.getCurriculum);
router.patch("/:id", auth(config.auth_level.admin), CurriculumController.updateCurriculum);
router.delete("/:id", auth(config.auth_level.admin), CurriculumController.deleteCurriculum);

// Topic routes - each on its own line to avoid chaining issues
router.post("/topics", auth(config.auth_level.admin), CurriculumController.createTopic);
router.get("/all-topics", auth(config.auth_level.admin), CurriculumController.getAllTopics);
router.get("/topics/:curriculumId", auth(config.auth_level.admin), CurriculumController.getTopicsByCurriculum);
router.get("/topic/:id", auth(config.auth_level.admin), CurriculumController.getTopic);
router.patch("/topics/:id", auth(config.auth_level.admin), CurriculumController.updateTopic);
router.delete("/topics/:id", auth(config.auth_level.admin), CurriculumController.deleteTopic);

// Question routes
router.post(
  "/questions",
  auth(config.auth_level.admin),
  uploadFile([{ name: "attachments", maxCount: 3 }]),
  CurriculumController.createQuestion
);
router.get("/questions/:topicId", auth(config.auth_level.admin), CurriculumController.getQuestionsByTopic);
router.get("/question/:id", auth(config.auth_level.admin), CurriculumController.getQuestion);
router.patch(
  "/questions/:id",
  auth(config.auth_level.admin),
  uploadFile([{ name: "attachments", maxCount: 3 }]),
  CurriculumController.updateQuestion
);
router.delete("/questions/:id", auth(config.auth_level.admin), CurriculumController.deleteQuestion);

module.exports = router;
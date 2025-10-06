const { CurriculumService } = require("./curriculum.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const createCurriculum = catchAsync(async (req, res) => {
  const result = await CurriculumService.createCurriculum(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Curriculum created successfully",
    data: result,
  });
});

const getAllCurriculums = catchAsync(async (req, res) => {
  const result = await CurriculumService.getAllCurriculums(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Curriculums retrieved successfully",
    data: result,
  });
});

const getCurriculum = catchAsync(async (req, res) => {
  const result = await CurriculumService.getCurriculum(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Curriculum retrieved successfully",
    data: result,
  });
});

const updateCurriculum = catchAsync(async (req, res) => {
  const result = await CurriculumService.updateCurriculum(req.params.id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Curriculum updated successfully",
    data: result,
  });
});

const deleteCurriculum = catchAsync(async (req, res) => {
  await CurriculumService.deleteCurriculum(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Curriculum deleted successfully",
  });
});

const createTopic = catchAsync(async (req, res) => {
  const result = await CurriculumService.createTopic(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Topic created successfully",
    data: result,
  });
});

const getTopicsByCurriculum = catchAsync(async (req, res) => {
  const result = await CurriculumService.getTopicsByCurriculum(req.params.curriculumId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Topics retrieved successfully",
    data: result,
  });
});

const getAllTopics = catchAsync(async (req, res) => {
  const result = await CurriculumService.getAllTopics(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Topics retrieved successfully",
    data: result,
  });
});

const getTopic = catchAsync(async (req, res) => {
  const result = await CurriculumService.getTopic(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Topic retrieved successfully",
    data: result,
  });
});

const updateTopic = catchAsync(async (req, res) => {
  const result = await CurriculumService.updateTopic(req.params.id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Topic updated successfully",
    data: result,
  });
});

const deleteTopic = catchAsync(async (req, res) => {
  await CurriculumService.deleteTopic(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Topic deleted successfully",
  });
});

const createQuestion = catchAsync(async (req, res) => {
  const result = await CurriculumService.createQuestion(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Question created successfully",
    data: result,
  });
});

const getQuestionsByTopic = catchAsync(async (req, res) => {
  const result = await CurriculumService.getQuestionsByTopic(req.params.topicId, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Questions retrieved successfully",
    data: result,
  });
});

const getQuestion = catchAsync(async (req, res) => {
  const result = await CurriculumService.getQuestion(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Question retrieved successfully",
    data: result,
  });
});

const updateQuestion = catchAsync(async (req, res) => {
  const result = await CurriculumService.updateQuestion(req.params.id, req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Question updated successfully",
    data: result,
  });
});

const deleteQuestion = catchAsync(async (req, res) => {
  await CurriculumService.deleteQuestion(req.params.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Question deleted successfully",
  });
});

const CurriculumController = {
  createCurriculum,
  getAllCurriculums,
  getCurriculum,
  updateCurriculum,
  deleteCurriculum,
  createTopic,
  getTopicsByCurriculum,
  getAllTopics,
  getTopic,
  updateTopic,
  deleteTopic,
  createQuestion,
  getQuestionsByTopic,
  getQuestion,
  updateQuestion,
  deleteQuestion,
};

module.exports = { CurriculumController };
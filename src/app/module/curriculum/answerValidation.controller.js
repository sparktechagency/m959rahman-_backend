const answerValidationService = require("./answerValidation.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const validateSingleAnswer = catchAsync(async (req, res) => {
  const { questionId, answer } = req.body;
  
  const result = await answerValidationService.validateSingleAnswer(questionId, answer);
  
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Answer validated successfully",
    data: result,
  });
});

const submitAndValidateAnswers = catchAsync(async (req, res) => {
  const result = await answerValidationService.submitAndValidateAnswers(req);
  
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Answers submitted and validated successfully",
    data: result,
  });
});

const getAnswerValidationDetails = catchAsync(async (req, res) => {
  const { questionId, answer } = req.query;
  
  if (!questionId || !answer) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "questionId and answer are required",
    });
  }
  
  const result = await answerValidationService.getAnswerValidationDetails(questionId, answer);
  
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Answer validation details retrieved successfully",
    data: result,
  });
});

const testAnswerSimilarity = catchAsync(async (req, res) => {
  const { answer1, answer2 } = req.body;
  
  if (!answer1 || !answer2) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "Both answers are required for similarity testing",
    });
  }
  
  const similarity = answerValidationService.calculateStringSimilarity(answer1, answer2);
  
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Similarity calculated successfully",
    data: {
      answer1,
      answer2,
      similarity: Math.round(similarity * 100) / 100,
      similarityPercentage: Math.round(similarity * 100)
    },
  });
});

const AnswerValidationController = {
  validateSingleAnswer,
  submitAndValidateAnswers,
  getAnswerValidationDetails,
  testAnswerSimilarity
};

module.exports = { AnswerValidationController };

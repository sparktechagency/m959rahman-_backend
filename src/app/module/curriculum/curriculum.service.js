const { status } = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../../../error/ApiError");
const Curriculum = require("../../module/curriculum/Curriculum");
const Topic = require("../../module/curriculum/Topic");
const Question = require("../../module/curriculum/Question");
const validateFields = require("../../../util/validateFields");
const QueryBuilder = require("../../../builder/queryBuilder");
const unlinkFile = require("../../../util/unlinkFile");

const createCurriculum = async (req) => {
  const { body: data, user } = req;
  validateFields(data, ["name"]);

  const existingCurriculum = await Curriculum.findOne({
    name: data.name,
    isActive: true,
  });

  if (existingCurriculum) {
    throw new ApiError(status.BAD_REQUEST, "Curriculum with this name already exists");
  }

  const curriculum = await Curriculum.create({
    ...data,
    createdBy: user.authId,
  });

  return curriculum;
};

const getAllCurriculums = async (query) => {
  const curriculumQuery = new QueryBuilder(
    Curriculum.find({ isActive: true })
      .populate("createdBy", "name email")
      .lean(),
    query
  )
    .search(["name", "description"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [curriculums, meta] = await Promise.all([
    curriculumQuery.modelQuery,
    curriculumQuery.countTotal(),
  ]);

  return {
    meta,
    curriculums,
  };
};

const getCurriculum = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid curriculum ID");
  }

  const curriculum = await Curriculum.findById(id)
    .populate("createdBy", "name email")
    .lean();

  if (!curriculum) {
    throw new ApiError(status.NOT_FOUND, "Curriculum not found");
  }

  return curriculum;
};

const updateCurriculum = async (id, data) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid curriculum ID");
  }

  const curriculum = await Curriculum.findByIdAndUpdate(
    id,
    { ...data },
    { new: true, runValidators: true }
  ).populate("createdBy", "name email");

  if (!curriculum) {
    throw new ApiError(status.NOT_FOUND, "Curriculum not found");
  }

  return curriculum;
};

const deleteCurriculum = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid curriculum ID");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const curriculum = await Curriculum.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true, session }
    );

    if (!curriculum) {
      throw new ApiError(status.NOT_FOUND, "Curriculum not found");
    }

    // Deactivate all topics under this curriculum
    await Topic.updateMany(
      { curriculumId: id },
      { isActive: false },
      { session }
    );

    // Deactivate all questions under topics of this curriculum
    const topics = await Topic.find({ curriculumId: id }, { _id: 1 }).session(session);
    const topicIds = topics.map(topic => topic._id);

    await Question.updateMany(
      { topicId: { $in: topicIds } },
      { isActive: false },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const createTopic = async (req) => {
  const { body: data, user } = req;
  validateFields(data, ["name", "curriculumId"]);

  // Check if curriculum exists
  const curriculum = await Curriculum.findOne({
    _id: data.curriculumId,
    isActive: true,
  });

  if (!curriculum) {
    throw new ApiError(status.NOT_FOUND, "Curriculum not found");
  }

  // Check if topic name already exists in this curriculum
  const existingTopic = await Topic.findOne({
    name: data.name,
    curriculumId: data.curriculumId,
    isActive: true,
  });

  if (existingTopic) {
    throw new ApiError(status.BAD_REQUEST, "Topic with this name already exists in this curriculum");
  }

  const topic = await Topic.create({
    ...data,
    createdBy: user.authId,
  });

  return await topic.populate("curriculumId", "name");
};

const getTopicsByCurriculum = async (curriculumId, query) => {
  if (!mongoose.Types.ObjectId.isValid(curriculumId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid curriculum ID");
  }

  const topicQuery = new QueryBuilder(
    Topic.find({
      curriculumId,
      isActive: true
    })
      .populate("curriculumId", "name")
      .populate("createdBy", "name email")
      .lean(),
    query
  )
    .search(["name"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [topics, meta] = await Promise.all([
    topicQuery.modelQuery,
    topicQuery.countTotal(),
  ]);

  return {
    meta,
    topics,
  };
};


const getTopic = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid topic ID");
  }

  const topic = await Topic.findById(id)
    .populate("curriculumId", "name")
    .populate("createdBy", "name email")
    .lean();

  if (!topic) {
    throw new ApiError(status.NOT_FOUND, "Topic not found");
  }

  return topic;
};


const getAllTopics = async () => {
  console.log('getAllTopics called');
  try {
    const topics = await Topic.find({ isActive: true })
      .select('-curriculumId')
      .populate('createdBy', 'name email')
      .lean();

    console.log('Successfully retrieved topics:', topics.length);
    return topics;
  } catch (error) {
    console.error('Error in getAllTopics:', error);
    throw new ApiError(500, 'Failed to fetch topics');
  }
};



const updateTopic = async (id, data) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid topic ID");
  }

  const topic = await Topic.findByIdAndUpdate(
    id,
    { ...data },
    { new: true, runValidators: true }
  )
    .populate("curriculumId", "name")
    .populate("createdBy", "name email");

  if (!topic) {
    throw new ApiError(status.NOT_FOUND, "Topic not found");
  }

  return topic;
};

const deleteTopic = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid topic ID");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const topic = await Topic.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true, session }
    );

    if (!topic) {
      throw new ApiError(status.NOT_FOUND, "Topic not found");
    }

    // Deactivate all questions under this topic
    await Question.updateMany(
      { topicId: id },
      { isActive: false },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const createQuestion = async (req) => {
  const { body: data, files, user } = req;
  validateFields(data, ["topicId", "questionText"]);

  // Check if topic exists
  const topic = await Topic.findOne({
    _id: data.topicId,
    isActive: true,
  });

  if (!topic) {
    throw new ApiError(status.NOT_FOUND, "Topic not found");
  }

  const questionData = {
    topicId: data.topicId,
    questionText: data.questionText,
    createdBy: user.authId,
  };

  // Handle image upload
  if (files && files.questionImage) {
    questionData.questionImage = files.questionImage[0].path;
  }

  // Parse partial marks from form-data
  if (data.partialMarks) {
    try {
      questionData.partialMarks = JSON.parse(data.partialMarks);
    } catch (error) {
      throw new ApiError(status.BAD_REQUEST, "Invalid partialMarks format");
    }
  }

  // Parse full marks from form-data
  if (data.fullMarks) {
    try {
      questionData.fullMarks = JSON.parse(data.fullMarks);
    } catch (error) {
      throw new ApiError(status.BAD_REQUEST, "Invalid fullMarks format");
    }
  }

  const question = await Question.create(questionData);
  return await question.populate("topicId", "name");
};


const getQuestionsByTopic = async (topicId, query) => {
  if (!mongoose.Types.ObjectId.isValid(topicId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid topic ID");
  }

  const questionQuery = new QueryBuilder(
    Question.find({ topicId, isActive: true })
      .populate("topicId", "name")
      .populate("createdBy", "name email")
      .lean(),
    query
  )
    .search(["questionText"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [questions, meta] = await Promise.all([
    questionQuery.modelQuery,
    questionQuery.countTotal(),
  ]);

  return {
    meta,
    questions,
  };
};


const getQuestion = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid question ID");
  }

  const question = await Question.findById(id)
    .populate("topicId", "name")
    .populate("createdBy", "name email")
    .lean();

  if (!question) {
    throw new ApiError(status.NOT_FOUND, "Question not found");
  }

  return question;
};

const updateQuestion = async (id, req) => {
  const { body: data, files } = req;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid question ID");
  }

  const existingQuestion = await Question.findById(id);
  if (!existingQuestion) {
    throw new ApiError(status.NOT_FOUND, "Question not found");
  }

  const updateData = { ...data };

  // Handle image upload
  if (files && files.questionImage) {
    updateData.questionImage = files.questionImage[0].path;
    if (existingQuestion.questionImage) {
      unlinkFile(existingQuestion.questionImage);
    }
  }

  // Parse partial marks from form-data
  if (data.partialMarks) {
    try {
      updateData.partialMarks = JSON.parse(data.partialMarks);
    } catch (error) {
      throw new ApiError(status.BAD_REQUEST, "Invalid partialMarks format");
    }
  }

  // Parse full marks from form-data
  if (data.fullMarks) {
    try {
      updateData.fullMarks = JSON.parse(data.fullMarks);
    } catch (error) {
      throw new ApiError(status.BAD_REQUEST, "Invalid fullMarks format");
    }
  }

  const question = await Question.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate("topicId", "name");

  return question;
};


const deleteQuestion = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid question ID");
  }

  const question = await Question.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );

  if (!question) {
    throw new ApiError(status.NOT_FOUND, "Question not found");
  }

  return question;
};

const CurriculumService = {
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

module.exports = { CurriculumService };
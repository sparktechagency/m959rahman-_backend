const deleteUploadedFiles = require("./deleteUploadedFiles");

const catchAsync = (fn) => {
  return async (req, res, next) => {
    try {
      return await fn(req, res, next);
    } catch (error) {
      deleteUploadedFiles(req.uploadedFiles);
      console.log(error);
      next(error);
    }
  };
};

module.exports = catchAsync;

const { deleteUploadedFiles, deleteUploadedS3Files } = require("./deleteUploadedFiles");

const catchAsync = (fn) => {
  return async (req, res, next) => {
    try {
      return await fn(req, res, next);
    } catch (error) {
      if (req.uploadedFiles) deleteUploadedFiles(req.uploadedFiles, false);
      if (req.uploadedS3Keys) deleteUploadedS3Files(req);
      console.log(error);
      next(error);
    }
  };
};

module.exports = catchAsync;

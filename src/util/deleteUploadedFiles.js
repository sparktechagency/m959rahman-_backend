const { deleteMultipleFromS3, extractS3KeyFromUrl } = require("./s3Utils");
const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

/**
 * Delete uploaded files (supports both local and S3)
 * @param {Array<String>} files - Array of file paths or URLs
 * @param {Boolean} isS3 - Whether files are in S3 or local storage
 */
const deleteUploadedFiles = async (files, isS3 = true) => {
  if (!files || files.length === 0) return;

  try {
    if (isS3) {
      // Extract S3 keys from URLs if needed
      const s3Keys = files.map((file) => {
        // If it's already a key (no http), use as-is
        if (!file.startsWith("http")) return file;
        // Otherwise extract from URL
        return extractS3KeyFromUrl(file);
      }).filter(Boolean); // Remove nulls

      if (s3Keys.length > 0) {
        await deleteMultipleFromS3(s3Keys);
        logger.info(`Deleted ${s3Keys.length} files from S3`);
      }
    } else {
      // Delete local files
      files.forEach((filePath) => {
        const fullPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          logger.info(`Deleted local file: ${filePath}`);
        }
      });
    }
  } catch (error) {
    logger.error("Error deleting uploaded files:", error);
    // Don't throw - file deletion is best effort
  }
};

/**
 * Delete S3 files from req.uploadedS3Keys (rollback helper)
 * @param {Object} req - Express request object
 */
const deleteUploadedS3Files = async (req) => {
  if (req.uploadedS3Keys && req.uploadedS3Keys.length > 0) {
    await deleteUploadedFiles(req.uploadedS3Keys, true);
  }
};

module.exports = { deleteUploadedFiles, deleteUploadedS3Files };

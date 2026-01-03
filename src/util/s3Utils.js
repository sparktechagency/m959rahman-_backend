const {
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const s3Client = require("./s3Client");
const config = require("../config");
const { logger } = require("./logger");

/**
 * Upload a file to S3
 * @param {Object} fileBuffer - File buffer from multer
 * @param {String} key - S3 object key (file path)
 * @param {String} mimetype - File MIME type
 * @returns {Promise<Object>} Upload result with Location URL
 */
const uploadToS3 = async (fileBuffer, key, mimetype) => {
    try {
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: config.aws.s3_bucket,
                Key: key,
                Body: fileBuffer,
                ContentType: mimetype,
                ACL: "public-read", // Make files publicly accessible
            },
        });

        upload.on("httpUploadProgress", (progress) => {
            logger.info(
                `Upload progress: ${Math.round((progress.loaded / progress.total) * 100)}%`
            );
        });

        const result = await upload.done();

        logger.info(`File uploaded successfully to S3: ${key}`);

        return {
            location: `https://${config.aws.s3_bucket}.s3.${config.aws.region}.amazonaws.com/${key}`,
            key: key,
            bucket: config.aws.s3_bucket,
            etag: result.ETag,
        };
    } catch (error) {
        logger.error("Error uploading to S3:", error);
        throw new Error(`S3 upload failed: ${error.message}`);
    }
};

/**
 * Delete a file from S3
 * @param {String} key - S3 object key (file path)
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (key) => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: config.aws.s3_bucket,
            Key: key,
        });

        await s3Client.send(command);
        logger.info(`File deleted from S3: ${key}`);
    } catch (error) {
        logger.error(`Error deleting from S3: ${key}`, error);
        throw new Error(`S3 delete failed: ${error.message}`);
    }
};

/**
 * Delete multiple files from S3
 * @param {Array<String>} keys - Array of S3 object keys
 * @returns {Promise<void>}
 */
const deleteMultipleFromS3 = async (keys) => {
    try {
        const deletePromises = keys.map((key) => deleteFromS3(key));
        await Promise.all(deletePromises);
        logger.info(`Deleted ${keys.length} files from S3`);
    } catch (error) {
        logger.error("Error deleting multiple files from S3:", error);
        throw error;
    }
};

/**
 * Get a signed URL for accessing a private S3 object
 * @param {String} key - S3 object key
 * @param {Number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<String>} Signed URL
 */
const getSignedUrl = async (key, expiresIn = 3600) => {
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

    try {
        const command = new GetObjectCommand({
            Bucket: config.aws.s3_bucket,
            Key: key,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        logger.error("Error generating signed URL:", error);
        throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
};

/**
 * Extract S3 key from full URL
 * @param {String} url - Full S3 URL
 * @returns {String} S3 key/path
 */
const extractS3KeyFromUrl = (url) => {
    try {
        // Extract key from URL like: https://bucket.s3.region.amazonaws.com/path/to/file
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1); // Remove leading slash
    } catch (error) {
        logger.error("Error extracting S3 key from URL:", error);
        return null;
    }
};

module.exports = {
    uploadToS3,
    deleteFromS3,
    deleteMultipleFromS3,
    getSignedUrl,
    extractS3KeyFromUrl,
};

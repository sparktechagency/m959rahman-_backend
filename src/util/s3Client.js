const { S3Client } = require("@aws-sdk/client-s3");
const config = require("../config");

/**
 * AWS S3 Client Configuration
 * Initialize S3 client with credentials from environment variables
 */
const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.access_key_id,
        secretAccessKey: config.aws.secret_access_key,
    },
});

module.exports = s3Client;

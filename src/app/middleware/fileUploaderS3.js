const multer = require("multer");
const multerS3 = require("multer-s3");
const s3Client = require("../../util/s3Client");
const config = require("../../config");

const allowedMimeTypes = [
    // Image types
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    // Video types
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    "video/3gp",
];

const isValidFileType = (mimetype) => allowedMimeTypes.includes(mimetype);

/**
 * File uploader with AWS S3 storage
 * Files are uploaded directly to S3 bucket
 */
const uploadFile = () => {
    const storage = multerS3({
        s3: s3Client,
        bucket: config.aws.s3_bucket,
        acl: "public-read", // Make files publicly accessible
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req, file, cb) {
            cb(null, {
                fieldName: file.fieldname,
                originalName: file.originalname,
                uploadedAt: new Date().toISOString(),
            });
        },
        key: function (req, file, cb) {
            // Generate unique filename with timestamp
            const timestamp = Date.now();
            const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
            const key = `${file.fieldname}/${timestamp}-${sanitizedName}`;

            // Store S3 keys in req.uploadedFiles for potential rollback
            if (!req.uploadedS3Keys) req.uploadedS3Keys = [];
            req.uploadedS3Keys.push(key);

            cb(null, key);
        },
    });

    const fileFilter = (req, file, cb) => {
        const allowedFieldNames = [
            "profile_image",
            "post_image",
            "attachments",
            "icon",
            "cover_image",
        ];

        // Allow requests without files
        if (!file.fieldname) return cb(null, true);

        // Check if the fieldname is valid
        if (!allowedFieldNames.includes(file.fieldname))
            return cb(new Error("Invalid fieldname"));

        // Check if the file type is valid
        if (isValidFileType(file.mimetype)) return cb(null, true);
        else return cb(new Error("Invalid file type"));
    };

    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 50 * 1024 * 1024, // 50MB limit for attachments (videos can be large)
        },
    }).fields([
        { name: "profile_image", maxCount: 1 },
        { name: "post_image", maxCount: 1 },
        { name: "attachments", maxCount: 5 },
        { name: "icon", maxCount: 1 },
        { name: "cover_image", maxCount: 1 },
    ]);

    return upload;
};

module.exports = { uploadFile };

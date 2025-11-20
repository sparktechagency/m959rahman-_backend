const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.join(process.cwd(), ".env"),
});

const validateConfig = (config) => {
  if (!config.jwt.secret) {
    throw new Error("Missing JWT secret");
  }
  if (!config.database_url) {
    throw new Error("Missing database URL");
  }
};

const config = {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  base_url: process.env.BASE_URL,
  database_url: process.env.MONGO_URL,
  auth_level: {
    user: ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"], // All authenticated users
    teacher: ["TEACHER", "ADMIN", "SUPER_ADMIN"], // Teacher and above
    school_admin: ["SCHOOL", "ADMIN", "SUPER_ADMIN"],
    admin: ["ADMIN", "SUPER_ADMIN"], // Admin and super admin
    super_admin: ["SUPER_ADMIN"], // Super admin only
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refresh_secret: process.env.JWT_REFRESH_SECRET,
    expires_in: process.env.JWT_EXPIRES_IN,
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS || 12,
  smtp: {
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_service: process.env.SMTP_SERVICE,
    smtp_mail: process.env.SMTP_MAIL,
    smtp_password: process.env.SMTP_PASSWORD,
    NAME: process.env.SERVICE_NAME,
  },
  cloudinary: {
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
    cloudinary_url: process.env.CLOUDINARY_URL,
  },
  stripe: {
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret_test: process.env.STRIPE_WEBHOOK_SECRET_TEST,
    stripe_webhook_secret_production:
      process.env.STRIPE_WEBHOOK_SECRET_PRODUCTION,
  },
  social_auth: {
    google: {
      client_id: process.env.GOOGLE_CLIENT_ID,
      android_client_id: process.env.GOOGLE_ANDROID_CLIENT_ID,
      ios_client_id: process.env.GOOGLE_IOS_CLIENT_ID,
    },
    facebook: {
      app_id: process.env.FACEBOOK_APP_ID,
      app_secret: process.env.FACEBOOK_APP_SECRET,
    },
    microsoft: {
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    },
    apple: {
      client_id: process.env.APPLE_CLIENT_ID,
    },
  },
  variables: {
    email_temp_image: process.env.EMAIL_TEMP_IMAGE,
    email_temp_text_secondary_color:
      process.env.EMAIL_TEMP_TEXT_SECONDARY_COLOR,
  },
};

// Validate configuration
validateConfig(config);

module.exports = config;
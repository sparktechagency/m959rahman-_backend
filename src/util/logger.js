const path = require("path");
const { createLogger, format, transports } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

const { combine, timestamp, label, printf } = format;

// Custom log format
const myFormat = printf(({ level, message, label, timestamp }) => {
  const date = new Date(timestamp);
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();

  return `${date.toDateString()} ${h}:${m}:${s} [${label}] ${level}: ${message}`;
});

const logDir = path.join(process.cwd(), "logs", "winston");

// Logger for general information
const logger = createLogger({
  level: "info",
  format: combine(label({ label: "MATH BOOK" }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new transports.File({
      level: "info",
      filename: path.join(logDir, "successes", "math-book-success.log"),
    }),
    new DailyRotateFile({
      level: "info",
      filename: path.join(logDir, "successes", "math-book-%DATE%-success.log"),
      datePattern: "YYYY-MM-DD-HH",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

// Logger for errors
const errorLogger = createLogger({
  level: "error",
  format: combine(label({ label: "MATH BOOK" }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      level: "error",
      filename: path.join(logDir, "errors", "math-book-%DATE%-error.log"),
      datePattern: "YYYY-MM-DD-HH",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

module.exports = { logger, errorLogger };

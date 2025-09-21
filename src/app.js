const express = require("express");
const cors = require("cors");
const globalErrorHandler = require("./app/middleware/globalErrorHandler");
const routes = require("./app/routes");
const NotFoundHandler = require("./error/NotFoundHandler");
const cookieParser = require("cookie-parser");
const corsOptions = require("./util/corsOptions");
const path = require("path");
// const webhookRoutes = require("./app/module/payment/webhook.routes");

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(cors(corsOptions));
// app.use("/stripe/webhook", webhookRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

app.use("/", routes);

app.get("/", async (req, res) => {
  res.json(`Welcome to ${process.env.SERVICE_NAME}`);
});

app.use(globalErrorHandler);
app.use(NotFoundHandler.handle);

module.exports = app;

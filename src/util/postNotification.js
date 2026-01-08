const AdminNotification = require("../app/module/notification/AdminNotification");
const Notification = require("../app/module/notification/Notification");
const catchAsync = require("./catchAsync");

const { EnumSocketEvent } = require("./enum");

const postNotification = catchAsync(async (title, message, toId = null) => {
  if (!title || !message)
    throw new Error("Missing required fields: title, or message");

  if (!toId) {
    await AdminNotification.create({ title, message });
  } else {
    const notification = await Notification.create({ toId, title, message });

    // Emit socket event if io is available
    if (global.io) {
      global.io.to(toId.toString()).emit(EnumSocketEvent.NOTIFICATION, notification);
    }
  }
});

module.exports = postNotification;

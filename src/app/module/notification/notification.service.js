const { default: status } = require("http-status");
const QueryBuilder = require("../../../builder/queryBuilder");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const Notification = require("./Notification");
const { EnumUserRole } = require("../../../util/enum");
const AdminNotification = require("./AdminNotification");

const getNotification = async (userData, query) => {
  const { role } = userData;
  const Model = role === EnumUserRole.ADMIN || role === EnumUserRole.SUPER_ADMIN ? AdminNotification : Notification;

  if (role !== EnumUserRole.ADMIN && role !== EnumUserRole.SUPER_ADMIN) {
    validateFields(query, ["notificationId"]);
  }

  const queryObj = (role === EnumUserRole.ADMIN || role === EnumUserRole.SUPER_ADMIN) 
    ? {} 
    : { _id: query.notificationId, toId: userData.userId };

  const notification = await Model.findOne(queryObj).lean();

  if (!notification)
    throw new ApiError(status.NOT_FOUND, "Notification not found");

  return notification;
};

/**
 * Retrieves notifications based on the user's role.
 *
 * - If the user is an **admin/super_admin**, it fetches all notifications from `AdminNotification`.
 * - If the user is a **student/teacher/school**, it fetches only notifications relevant to them from `Notification`.
 */
const getAllNotifications = async (userData, query) => {
  const { role } = userData;

  const Model = (role === EnumUserRole.ADMIN || role === EnumUserRole.SUPER_ADMIN) ? AdminNotification : Notification;
  const queryObj = (role === EnumUserRole.ADMIN || role === EnumUserRole.SUPER_ADMIN) ? {} : { toId: userData.userId };

  const notificationQuery = new QueryBuilder(Model.find(queryObj).lean(), query)
    .search(["title", "message"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [notification, meta] = await Promise.all([
    notificationQuery.modelQuery,
    notificationQuery.countTotal(),
  ]);

  return {
    meta,
    notification,
  };
};

const updateAsReadUnread = async (userData, payload) => {
  const { role } = userData;

  const Model = (role === EnumUserRole.ADMIN || role === EnumUserRole.SUPER_ADMIN) ? AdminNotification : Notification;
  
  let queryObj = {};
  if (role === EnumUserRole.ADMIN || role === EnumUserRole.SUPER_ADMIN) {
    // Admin can update all notifications or specific ones
    if (payload.notificationId) {
      queryObj._id = payload.notificationId;
    }
  } else {
    // Other roles can only update their own notifications
    queryObj.toId = userData.userId;
    if (payload.notificationId) {
      queryObj._id = payload.notificationId;
    }
  }

  const result = await Model.updateMany(queryObj, {
    $set: { isRead: payload.isRead },
  });

  return result;
};

const deleteNotification = async (userData, payload) => {
  validateFields(payload, ["notificationId"]);

  const Model = (userData.role === EnumUserRole.ADMIN || userData.role === EnumUserRole.SUPER_ADMIN) ? AdminNotification : Notification;

  let queryObj = { _id: payload.notificationId };
  
  // For non-admin users, ensure they can only delete their own notifications
  if (userData.role !== EnumUserRole.ADMIN && userData.role !== EnumUserRole.SUPER_ADMIN) {
    queryObj.toId = userData.userId;
  }

  const notification = await Model.deleteOne(queryObj);

  if (!notification.deletedCount)
    throw new ApiError(status.NOT_FOUND, "Notification not found");

  return notification;
};

const NotificationService = {
  getNotification,
  getAllNotifications,
  updateAsReadUnread,
  deleteNotification,
};

module.exports = NotificationService;

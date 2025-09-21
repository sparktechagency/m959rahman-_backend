const EnumUserRole = {
    STUDENT: "STUDENT",
    TEACHER: "TEACHER",
    SCHOOL: "SCHOOL",
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
  };
  
  const EnumPaymentStatus = {
    SUCCEEDED: "succeeded",
    UNPAID: "unpaid",
  };
  
  const EnumSocketEvent = {
    CONNECTION: "connection",
    DISCONNECT: "disconnect",
  
    SOCKET_ERROR: "socket_error",
    ONLINE_STATUS: "online_status",
    LOCATION_UPDATE: "location_update",
  
    START_CHAT: "start_chat",
    SEND_MESSAGE: "send_message",
  };
  
  const EnumUserAccountStatus = {
    VERIFIED: "verified",
    UNVERIFIED: "unverified",
  };
  
  const EnumSubscriptionPlan = {
    GOLD: "gold",
    SILVER: "silver",
    BRONZE: "bronze",
    JACKPOT_CHASE: "jackpot_chase",
    TRIPE_THREAT: "triple_threat",
    QUICK_HIT: "quick_hit",
  };
  
  const EnumSubscriptionPlanDuration = {
    DAILY: "daily",
    MONTHLY: "monthly",
    YEARLY: "yearly",
  };
  
  const EnumSubscriptionStatus = {
    ACTIVE: "active",
    EXPIRED: "expired",
  };
  
  module.exports = {
    EnumUserRole,
    EnumPaymentStatus,
    EnumSocketEvent,
    EnumUserAccountStatus,
    EnumSubscriptionPlan,
    EnumSubscriptionPlanDuration,
    EnumSubscriptionStatus,
  };
  
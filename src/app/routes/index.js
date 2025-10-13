const express = require("express");
const router = express.Router();
const AuthRoutes = require("../module/auth/auth.routes");
const AdminRoutes = require("../module/admin/admin.routes");
const SuperAdminRoutes = require("../module/superAdmin/superAdmin.routes");
const UserRoutes = require("../module/user/user.routes");
const CurriculumRoutes = require("../module/curriculum/curriculum.routes");
const StudentRoutes = require("../module/student/student.routes");
const TeacherRoutes = require("../module/teacher/teacher.routes");
// const PhoneVerificationRoutes = require("../module/phoneVerification/phon  eVerification.routes");
// const DashboardRoutes = require("../module/dashboard/dashboard.routes");
const ManageRoutes = require("../module/manage/manage.routes");
// const NotificationRoutes = require("../module/notification/notification.routes");
// const FeedbackRoutes = require("../module/feedback/feedback.routes");
// const ReviewRoutes = require("../module/review/review.routes");
// const PostRoutes = require("../module/post/post.routes");
// const SubscriptionPlanRoutes = require("../module/subscriptionPlan/subscriptionPlan.routes");
// const PaymentRoutes = require("../module/payment/payment.routes");

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/user",
    route: UserRoutes,
  },
  {
    path: "/student",
    route: StudentRoutes,
  },
  {
    path: "/admin",
    route: AdminRoutes,
  },
  {
    path: "/super-admin",
    route: SuperAdminRoutes,
  },
  {
    path: "/manage",
    route: ManageRoutes,
  },
  {
    path: "/curriculum",
    route: CurriculumRoutes,
  },
  {
    path: "/teacher",
    route: TeacherRoutes,
  },
  // {
  //   path: "/notification",
  //   route: NotificationRoutes,
  // },
  // {
  //   path: "/feedback",
  //   route: FeedbackRoutes,
  // },
  // {
  //   path: "/review",
  //   route: ReviewRoutes,
  // },
  // {
  //   path: "/post",
  //   route: PostRoutes,
  // },
  // {
  //   path: "/subscription-plan",
  //   route: SubscriptionPlanRoutes,
  // },
  // {
  //   path: "/payment",
  //   route: PaymentRoutes,
  // },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

module.exports = router;

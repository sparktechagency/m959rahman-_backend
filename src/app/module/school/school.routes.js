const express = require("express");
const schoolController = require("./school.controller");
const auth = require("../../middleware/auth");
const config = require("../../../config");
const { EnumUserRole } = require("../../../util/enum");
const { uploadFile } = require('../../middleware/fileUploader');
const router = express.Router();

// Teacher management routes
router
    .post(
        "/:schoolId/teachers",
        auth(config.auth_level.school_admin),
        schoolController.addTeacherToSchool
    )
    .get(
        "/:schoolId/teachers",
        auth(config.auth_level.school_admin),
        schoolController.getAllTeachersInSchool
    )
    .get(
        "/:schoolId/teachers/:teacherId",
        auth(config.auth_level.school_admin),
        schoolController.getTeacherDetails
    )
    .put(
        "/:schoolId/teachers/:teacherId/status",
        auth(config.auth_level.school_admin),
        schoolController.updateTeacherStatus
    )
    .delete(
        "/:schoolId/teachers/:teacherId",
        auth(config.auth_level.school_admin),
        schoolController.removeTeacherFromSchool
    );

// Dashboard routes
router
    .get(
        "/:schoolId/dashboard",
        auth(config.auth_level.school_admin),
        schoolController.getSchoolDashboardStats
    );


// My school profile routes (for logged-in school)
router
    .get(
        "/my-profile",
        auth(config.auth_level.school_admin),
        schoolController.getMySchoolProfile
    )
    .put(
        "/my-profile",
        auth(config.auth_level.school_admin),
        uploadFile(),
        schoolController.updateSchoolProfile
    );

// School profile routes (with schoolId parameter)
router
    .get(
        "/:schoolId/profile",
        auth(config.auth_level.school_admin),
        schoolController.getSchoolProfile
    )
    .put(
        "/:schoolId/profile",
        auth(config.auth_level.school_admin),
        uploadFile(),
        schoolController.updateSchoolProfile
    )

// All schools routes
router
    .get(
        "/all",
        auth(config.auth_level.admin),
        schoolController.getAllSchools
    )
    .get(
        "/:schoolId",
        auth(config.auth_level.admin),
        schoolController.getSchoolDetails
    )
    .patch(
        "/:schoolId",
        auth(config.auth_level.admin),
        schoolController.blockUnblockSchool
    );

module.exports = router;
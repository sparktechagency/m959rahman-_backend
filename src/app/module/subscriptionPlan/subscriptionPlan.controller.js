const SubscriptionPlanService = require("./subscriptionPlan.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const postSubscriptionPlan = catchAsync(async (req, res) => {
    const result = await SubscriptionPlanService.postSubscriptionPlan(
        req.user,
        req.body
    );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "SubscriptionPlan created",
        data: result,
    });
});

const getSubscriptionPlan = catchAsync(async (req, res) => {
    const result = await SubscriptionPlanService.getSubscriptionPlan(
        req.user,
        req.query
    );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "SubscriptionPlan retrieved",
        data: result,
    });
});

const getAllSubscriptionPlans = catchAsync(async (req, res) => {
    const result = await SubscriptionPlanService.getAllSubscriptionPlans(
        req.user,
        req.query
    );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "SubscriptionPlans retrieved",
        data: result,
    });
});

const updateSubscriptionPlan = catchAsync(async (req, res) => {
    const result = await SubscriptionPlanService.updateSubscriptionPlan(
        req.user,
        req.body
    );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "SubscriptionPlan updated",
        data: result,
    });
});

const deleteSubscriptionPlan = catchAsync(async (req, res) => {
    const result = await SubscriptionPlanService.deleteSubscriptionPlan(
        req.user,
        req.body
    );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "SubscriptionPlan deleted",
        data: result,
    });
});

const updateSubscriptionSectionVisibility = catchAsync(async (req, res) => {
    const result =
        await SubscriptionPlanService.updateSubscriptionSectionVisibility(
            req.user,
            req.body
        );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "SubscriptionPlan updated",
        data: result,
    });
});

const getSubscriptionSectionVisibility = catchAsync(async (req, res) => {
    const result = await SubscriptionPlanService.getSubscriptionSectionVisibility(
        req.user,
        req.query
    );
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "SubscriptionPlan retrieved",
        data: result,
    });
});

const SubscriptionPlanController = {
    postSubscriptionPlan,
    getSubscriptionPlan,
    getAllSubscriptionPlans,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    updateSubscriptionSectionVisibility,
    getSubscriptionSectionVisibility,
};

module.exports = SubscriptionPlanController;

const { default: status } = require("http-status");
const SubscriptionPlan = require("./SubscriptionPlan");
const QueryBuilder = require("../../../builder/queryBuilder");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const IsVisible = require("./IsVisible");
const deleteFalsyField = require("../../../util/deleteFalsyField");

const postSubscriptionPlan = async (userData, payload) => {
    validateFields(payload, [
        "subscriptionType",
        "features",
        "price",
        "duration",
    ]);

    const subscriptionPlanData = {
        subscriptionType: payload.subscriptionType,
        features: payload.features,
        price: payload.price,
        duration: payload.duration,
    };

    const newSubscriptionPlan = await SubscriptionPlan.create(
        subscriptionPlanData
    );
    return newSubscriptionPlan;
};

const getSubscriptionPlan = async (userData, query) => {
    validateFields(query, ["subscriptionPlanId"]);

    const subscriptionPlan = await SubscriptionPlan.findOne({
        _id: query.subscriptionPlanId,
    }).lean();

    if (!subscriptionPlan)
        throw new ApiError(status.NOT_FOUND, "SubscriptionPlan not found");

    return subscriptionPlan;
};

const getAllSubscriptionPlans = async (userData, query) => {
    deleteFalsyField(query);

    const subscriptionPlanQuery = new QueryBuilder(
        SubscriptionPlan.find({}).lean(),
        query
    )
        .search([])
        .filter()
        .sort()
        .paginate()
        .fields();

    const [subscriptionPlans, meta] = await Promise.all([
        subscriptionPlanQuery.modelQuery,
        subscriptionPlanQuery.countTotal(),
    ]);

    return {
        meta,
        subscriptionPlans,
    };
};

const updateSubscriptionPlan = async (userData, payload) => {
    validateFields(payload, ["subscriptionPlanId"]);

    const updateData = {
        ...(payload.features && { features: payload.features }),
        ...(payload.price && { price: payload.price }),
        ...(payload.duration && { duration: payload.duration }),
    };

    const subscriptionPlan = await SubscriptionPlan.findOneAndUpdate(
        { _id: payload.subscriptionPlanId },
        updateData,
        { new: true, runValidators: true }
    ).lean();

    if (!subscriptionPlan)
        throw new ApiError(status.NOT_FOUND, "SubscriptionPlan not found");
    return subscriptionPlan;
};

const deleteSubscriptionPlan = async (userData, payload) => {
    validateFields(payload, ["subscriptionPlanId"]);

    const subscriptionPlan = await SubscriptionPlan.deleteOne({
        _id: payload.subscriptionPlanId,
    });

    if (!subscriptionPlan.deletedCount)
        throw new ApiError(status.NOT_FOUND, "SubscriptionPlan not found");

    return subscriptionPlan;
};

const updateSubscriptionSectionVisibility = async (userData, payload) => {
    const isVisible = await IsVisible.findOne({});

    isVisible.isVisible = !isVisible.isVisible;
    await isVisible.save();

    return isVisible;
};

const getSubscriptionSectionVisibility = async (userData, payload) => {
    const isVisible = await IsVisible.findOne({}).lean();

    return isVisible;
};

const SubscriptionPlanService = {
    postSubscriptionPlan,
    getSubscriptionPlan,
    getAllSubscriptionPlans,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    updateSubscriptionSectionVisibility,
    getSubscriptionSectionVisibility,
};

module.exports = SubscriptionPlanService;

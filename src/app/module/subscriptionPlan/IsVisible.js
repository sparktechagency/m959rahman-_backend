const { Schema, model } = require("mongoose");

const isVisibleSchema = new Schema(
    {
        isVisible: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const IsVisible = model("IsVisible", isVisibleSchema);

module.exports = IsVisible;

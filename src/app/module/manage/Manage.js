const mongoose = require("mongoose");
const { model } = require("mongoose");

const termsAndConditionsSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const privacySchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["STUDENT", "TEACHER", "SCHOOL"],
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

const aboutUsSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const contactUsSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    facebookLink: {
      type: String
    },
    linkedinLink: {
      type: String
    },
    instagramLink: {
      type: String
    }
  },
  {
    timestamps: true,
  }
);

const supportSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      default: ""
    },
    opinion: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING"
    }
  },
  {
    timestamps: true,
  }
)



module.exports = {
  PrivacyPolicy: model("PrivacyPolicy", privacySchema),
  TermsConditions: model("TermsConditions", termsAndConditionsSchema),
  FAQ: model("FAQ", faqSchema),
  AboutUs: model("AboutUs", aboutUsSchema),
  ContactUs: model("ContactUs", contactUsSchema),
  Support: model("Support", supportSchema),
};

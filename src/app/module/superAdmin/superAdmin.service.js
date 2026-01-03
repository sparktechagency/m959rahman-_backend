const { default: status } = require("http-status");
const ApiError = require("../../../error/ApiError");
const Auth = require("../auth/Auth");
const SuperAdmin = require("./SuperAdmin");
const unlinkFile = require("../../../util/unlinkFile");
const validateFields = require("../../../util/validateFields");
const { EnumUserRole } = require("../../../util/enum");
const EmailHelpers = require("../../../util/emailHelpers");

const updateProfile = async (req) => {
  const { files, body: data } = req;
  const { userId, authId } = req.user;
  const updatedData = {
    ...(data.address && { address: data.address }),
    ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
    ...(data.name && { name: data.name }),
  };
  const existingUser = await SuperAdmin.findById(userId).lean();

  if (files && files.profile_image) {
    updatedData.profile_image = files.profile_image[0].location;
    if (existingUser.profile_image) unlinkFile(existingUser.profile_image);
  }

  const [auth, admin] = await Promise.all([
    Auth.findByIdAndUpdate(
      authId,
      { name: updatedData.name },
      {
        new: true,
      }
    ),
    SuperAdmin.findByIdAndUpdate(
      userId,
      { ...updatedData },
      {
        new: true,
      }
    ).populate("authId"),
  ]);

  if (!auth || !admin) throw new ApiError(status.NOT_FOUND, "User not found!");

  return admin;
};

const getProfile = async (userData) => {
  const { userId, authId } = userData;

  const [auth, result] = await Promise.all([
    Auth.findById(authId),
    SuperAdmin.findById(userId).populate("authId"),
  ]);

  if (!result || !auth) throw new ApiError(status.NOT_FOUND, "Admin not found");
  if (auth.isBlocked)
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");

  return result;
};

const deleteMyAccount = async (payload) => {
  const { email, password } = payload;

  const isUserExist = await Auth.isAuthExist(email);
  if (!isUserExist) throw new ApiError(status.NOT_FOUND, "User does not exist");
  if (
    isUserExist.password &&
    !(await Auth.isPasswordMatched(password, isUserExist.password))
  ) {
    throw new ApiError(status.FORBIDDEN, "Password is incorrect");
  }

  Promise.all([
    Auth.deleteOne({ email }),
    SuperAdmin.deleteOne({ authId: isUserExist._id }),
  ]);
};

const createSuperAdmin = async (req) => {
  const { body: payload, files } = req;

  validateFields(payload, [
    "name",
    "email",
    "password",
    "confirmPassword",
    "phoneNumber",
  ]);

  if (payload.password !== payload.confirmPassword)
    throw new ApiError(status.BAD_REQUEST, "Passwords do not match");

  // Check if email already exists
  const existingAuth = await Auth.findOne({ email: payload.email });
  if (existingAuth) {
    throw new ApiError(status.BAD_REQUEST, "Email already exists");
  }

  const authData = {
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: EnumUserRole.SUPER_ADMIN,
    isActive: true, // Super admins are activated immediately
  };

  const auth = await Auth.create(authData);

  const superAdminData = {
    authId: auth._id,
    name: payload.name,
    email: payload.email,
    phoneNumber: payload.phoneNumber,
    ...(files?.profile_image && { profile_image: files.profile_image[0].location }),
  };

  const superAdmin = await SuperAdmin.create(superAdminData);

  // Send welcome email to super admin
  EmailHelpers.sendAddAdminEmailTemp(payload.email, {
    password: payload.password,
    name: payload.name,
    role: "Super Admin",
  });

  return superAdmin;
};

const createInitialSuperAdmin = async (payload) => {
  validateFields(payload, [
    "name",
    "email",
    "password",
    "confirmPassword",
    "phoneNumber",
  ]);

  if (payload.password !== payload.confirmPassword)
    throw new ApiError(status.BAD_REQUEST, "Passwords do not match");

  // Check if any super admin already exists
  const existingSuperAdmin = await Auth.findOne({ role: EnumUserRole.SUPER_ADMIN });
  if (existingSuperAdmin) {
    throw new ApiError(status.BAD_REQUEST, "Initial super admin already exists");
  }

  // Check if email already exists
  const existingAuth = await Auth.findOne({ email: payload.email });
  if (existingAuth) {
    throw new ApiError(status.BAD_REQUEST, "Email already exists");
  }

  const authData = {
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: EnumUserRole.SUPER_ADMIN,
    isActive: true, // Initial super admin is activated immediately
  };

  const auth = await Auth.create(authData);

  const superAdminData = {
    authId: auth._id,
    name: payload.name,
    email: payload.email,
    phoneNumber: payload.phoneNumber,
  };

  const superAdmin = await SuperAdmin.create(superAdminData);

  // Send welcome email to initial super admin
  EmailHelpers.sendAddAdminEmailTemp(payload.email, {
    password: payload.password,
    name: payload.name,
    role: "Initial Super Admin",
  });

  return superAdmin;
};

const getAllSuperAdmins = async (userData, query) => {
  const { QueryBuilder } = require("../../../builder/queryBuilder");

  const superAdminQuery = new QueryBuilder(
    SuperAdmin.find({}).populate("authId").lean(),
    query
  )
    .search(["name", "email"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [superAdmins, meta] = await Promise.all([
    superAdminQuery.modelQuery,
    superAdminQuery.countTotal(),
  ]);

  return {
    meta,
    superAdmins,
  };
};

const SuperAdminService = {
  updateProfile,
  getProfile,
  deleteMyAccount,
  createSuperAdmin,
  createInitialSuperAdmin,
  getAllSuperAdmins,
};

module.exports = { SuperAdminService };

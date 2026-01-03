const bcrypt = require("bcrypt");
const cron = require("node-cron");
const { status } = require("http-status");

const ApiError = require("../../../error/ApiError");
const config = require("../../../config");
const { jwtHelpers } = require("../../../util/jwtHelpers");
const { EnumUserRole } = require("../../../util/enum");
const { logger } = require("../../../util/logger");
const Auth = require("./Auth");
const codeGenerator = require("../../../util/codeGenerator");
const Student = require("../student/Student");
const SuperAdmin = require("../superAdmin/SuperAdmin");
const validateFields = require("../../../util/validateFields");
const EmailHelpers = require("../../../util/emailHelpers");
const Admin = require("../admin/Admin");
const Teacher = require("../teacher/Teacher");
const School = require("../school/School");
const postNotification = require("../../../util/postNotification");
const Class = require("../class/Class");
const admin = require("../../../util/firbaseAdmin");
const SocialAuthProviders = require("../../../util/socialAuthProviders");



const registrationAccount = async (payload) => {
  const { role, firstname, lastname, password, confirmPassword, email } = payload;

  validateFields(payload, [
    "password",
    "confirmPassword",
    "email",
    "role",
    "firstname",
    "lastname",
  ]);

  const { code: activationCode, expiredAt: activationCodeExpire } =
    codeGenerator(3);
  const authData = {
    role,
    firstname,
    lastname,
    email,
    password,
    activationCode,
    activationCodeExpire,
  };
  const data = {
    user: firstname + " " + lastname,
    activationCode,
    activationCodeExpire: Math.round(
      (activationCodeExpire - Date.now()) / (60 * 1000)
    ),
  };

  if (!Object.values(EnumUserRole).includes(role))
    throw new ApiError(status.BAD_REQUEST, "Invalid role");
  if (password !== confirmPassword)
    throw new ApiError(
      status.BAD_REQUEST,
      "Password and Confirm Password didn't match"
    );

  const user = await Auth.findOne({ email });
  if (user) {
    const message = user.isActive
      ? "Account active. Please Login"
      : "Already have an account. Please activate";

    if (!user.isActive) {
      user.activationCode = activationCode;
      user.activationCodeExpire = activationCodeExpire;
      await user.save();

      EmailHelpers.sendOtpResendEmail(email, data);
    }

    return {
      isActive: user.isActive,
      message,
    };
  }

  if (role === EnumUserRole.STUDENT)
    EmailHelpers.sendActivationEmail(email, data);

  if (role === EnumUserRole.TEACHER)
    EmailHelpers.sendActivationEmail(email, data);

  if (role === EnumUserRole.SCHOOL)
    EmailHelpers.sendActivationEmail(email, data);

  const auth = await Auth.create(authData);

  const userData = {
    authId: auth._id,
    firstName: firstname,
    lastName: lastname,
    email,
    phoneNumber: payload.phoneNumber,
  };

  switch (role) {
    case EnumUserRole.SUPER_ADMIN:
      await SuperAdmin.create(userData);
      break;
    case EnumUserRole.ADMIN:
      await Admin.create(userData);
      break;
    case EnumUserRole.STUDENT:
      await Student.create(userData);
      break;
    case EnumUserRole.TEACHER:
      await Teacher.create(userData);
      break;
    case EnumUserRole.SCHOOL:
      await School.create(userData);
      break;
    default:
      throw new ApiError(status.BAD_REQUEST, "Invalid role. But auth created");
  }

  return {
    isActive: false,
    message: "Account created successfully. Please check your email",
  };
};

const resendActivationCode = async (payload) => {
  const email = payload.email;

  const user = await Auth.isAuthExist(email);
  if (!user) throw new ApiError(status.BAD_REQUEST, "Email not found!");

  const { code: activationCode, expiredAt: activationCodeExpire } =
    codeGenerator(3);
  const data = {
    user: user.firstname + " " + user.lastname,
    code: activationCode,
    expiresIn: Math.round((activationCodeExpire - Date.now()) / (60 * 1000)),
  };

  user.activationCode = activationCode;
  user.activationCodeExpire = activationCodeExpire;
  await user.save();

  EmailHelpers.sendOtpResendEmail(email, data);
};

const activateAccount = async (payload) => {
  const { activationCode, email } = payload;

  const auth = await Auth.findOne({ email });
  if (!auth) throw new ApiError(status.NOT_FOUND, "User not found");
  if (!auth.activationCode)
    throw new ApiError(
      status.NOT_FOUND,
      "Activation code not found. Get a new activation code"
    );
  if (auth.activationCode !== activationCode)
    throw new ApiError(status.BAD_REQUEST, "Code didn't match!");

  await Auth.updateOne(
    { email: email },
    { isActive: true },
    {
      new: true,
      runValidators: true,
    }
  );

  let result;

  switch (auth.role) {
    case EnumUserRole.SUPER_ADMIN:
      result = await SuperAdmin.findOne({ authId: auth._id }).lean();
      break;
    case EnumUserRole.ADMIN:
      result = await Admin.findOne({ authId: auth._id }).lean();
      break;
    case EnumUserRole.STUDENT:
      result = await Student.findOne({ authId: auth._id }).lean();
      break;
    case EnumUserRole.TEACHER:
      result = await Teacher.findOne({ authId: auth._id }).lean();
      // console.log(result)
      break;
    case EnumUserRole.SCHOOL:
      result = await School.findOne({ authId: auth._id }).lean();
      // console.log(result)
      break;
    default:
      result = await Auth.findOne({ authId: auth._id }).lean();
  }

  // Send notification to admin when new student/teacher/school registers
  if (auth.role === EnumUserRole.STUDENT || auth.role === EnumUserRole.TEACHER || auth.role === EnumUserRole.SCHOOL) {
    try {
      await postNotification(
        "New User Registration",
        `A new ${auth?.role?.toLowerCase()} has registered: ${result?.firstName} ${result?.lastName} (${email})`
      );
    } catch (notificationError) {
      logger.error("Failed to send admin notification:", notificationError);
    }
  }

  const tokenPayload = {
    authId: auth._id,
    userId: result._id,
    email,
    role: auth.role,
  };

  const accessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.secret,
    config.jwt.expires_in
  );
  const refreshToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.refresh_secret,
    config.jwt.refresh_expires_in
  );

  // Check if student is in any class and include this information
  let classMembershipInfo = {};
  if (auth.role === EnumUserRole.STUDENT) {
    classMembershipInfo = await checkStudentClassMembership(result._id);
  }

  return {
    accessToken,
    refreshToken,
    user: {
      ...result,
      ...classMembershipInfo
    }
  };
};

const loginAccount = async (payload) => {
  const { email, password } = payload;

  const auth = await Auth.isAuthExist(email);

  if (!auth) throw new ApiError(status.NOT_FOUND, "User does not exist");
  if (!auth.isActive)
    throw new ApiError(
      status.BAD_REQUEST,
      "Please activate your account then try to login"
    );
  if (auth.isBlocked)
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");

  if (
    auth.password &&
    !(await Auth.isPasswordMatched(password, auth.password))
  ) {
    throw new ApiError(status.BAD_REQUEST, "Password is incorrect");
  }

  let result;
  switch (auth.role) {
    case EnumUserRole.SUPER_ADMIN:
      result = await SuperAdmin.findOne({ authId: auth._id })
        .populate("authId")
        .lean();
      break;
    case EnumUserRole.ADMIN:
      result = await Admin.findOne({ authId: auth._id })
        .populate("authId")
        .lean();
      break;
    case EnumUserRole.STUDENT:
      result = await Student.findOne({ authId: auth._id })
        .populate("authId")
        .lean();
      break;
    case EnumUserRole.TEACHER:
      result = await Teacher.findOne({ authId: auth._id })
        .populate("authId")
        .lean();
      // console.log("Teacher", result)
      break;
    case EnumUserRole.SCHOOL:
      result = await School.findOne({ authId: auth._id })
        .populate("authId")
        .lean();
      break;
    default:
      result = await Auth.findOne({ authId: auth._id })
        .populate("authId")
        .lean();
  }

  // Check if result exists
  if (!result) {
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Profile data not found. Please contact support.");
  }

  const tokenPayload = {
    authId: auth._id,
    userId: result._id,
    email,
    role: auth.role,
  };

  const accessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.secret,
    config.jwt.expires_in
  );

  // Check if student is in any class and include this information
  let classMembershipInfo = {};
  if (auth.role === EnumUserRole.STUDENT) {
    classMembershipInfo = await checkStudentClassMembership(result._id);
  }

  return {
    user: {
      ...result,
      ...classMembershipInfo
    },
    accessToken,
  };
};

const forgotPass = async (payload) => {
  const { email } = payload;

  if (!email) throw new ApiError(status.BAD_REQUEST, "Missing email");

  const user = await Auth.isAuthExist(email);
  if (!user) throw new ApiError(status.BAD_REQUEST, "User not found!");

  const { code: verificationCode, expiredAt: verificationCodeExpire } =
    codeGenerator(3);

  user.verificationCode = verificationCode;
  user.verificationCodeExpire = verificationCodeExpire;
  await user.save();

  const data = {
    name: user.name,
    verificationCode,
    verificationCodeExpire: Math.round(
      (verificationCodeExpire - Date.now()) / (60 * 1000)
    ),
  };

  EmailHelpers.sendResetPasswordEmail(email, data);
};

const forgetPassOtpVerify = async (payload) => {
  const { email, code } = payload;

  if (!email) throw new ApiError(status.BAD_REQUEST, "Missing email");

  const auth = await Auth.findOne({ email: email });
  if (!auth) throw new ApiError(status.NOT_FOUND, "Account does not exist!");
  if (!auth.verificationCode)
    throw new ApiError(
      status.NOT_FOUND,
      "No verification code. Get a new verification code"
    );
  if (auth.verificationCode !== code)
    throw new ApiError(status.BAD_REQUEST, "Invalid verification code!");

  await Auth.updateOne(
    { email: auth.email },
    { isVerified: true, verificationCode: null }
  );
};

const resetPassword = async (payload) => {
  const { email, newPassword, confirmPassword } = payload;

  if (newPassword !== confirmPassword)
    throw new ApiError(status.BAD_REQUEST, "Passwords do not match");

  const auth = await Auth.isAuthExist(email);
  if (!auth) throw new ApiError(status.NOT_FOUND, "User not found!");
  if (!auth.isVerified)
    throw new ApiError(status.FORBIDDEN, "Please complete OTP verification");

  const hashedPassword = await hashPass(newPassword);

  await Auth.updateOne(
    { email },
    {
      $set: { password: hashedPassword },
      $unset: {
        isVerified: "",
        verificationCode: "",
        verificationCodeExpire: "",
      },
    }
  );
};

const changePassword = async (userData, payload) => {
  const { email } = userData;
  const { oldPassword, newPassword, confirmPassword } = payload;

  validateFields(payload, ["oldPassword", "newPassword", "confirmPassword"]);

  if (newPassword !== confirmPassword)
    throw new ApiError(
      status.BAD_REQUEST,
      "Password and confirm password do not match"
    );

  const isUserExist = await Auth.isAuthExist(email);

  if (!isUserExist)
    throw new ApiError(status.NOT_FOUND, "Account does not exist!");
  if (
    isUserExist.password &&
    !(await Auth.isPasswordMatched(oldPassword, isUserExist.password))
  ) {
    throw new ApiError(status.BAD_REQUEST, "Old password is incorrect");
  }

  isUserExist.password = newPassword;
  isUserExist.save();
};

const updateFieldsWithCron = async (check) => {
  const now = new Date();
  let result;

  if (check === "activation") {
    result = await Auth.updateMany(
      {
        activationCodeExpire: { $lte: now },
      },
      {
        $unset: {
          activationCode: "",
          activationCodeExpire: "",
        },
      }
    );
  }

  if (check === "verification") {
    result = await Auth.updateMany(
      {
        verificationCodeExpire: { $lte: now },
      },
      {
        $unset: {
          isVerified: "",
          verificationCode: "",
          verificationCodeExpire: "",
        },
      }
    );
  }

  if (result.modifiedCount > 0)
    logger.info(
      `Removed ${result.modifiedCount} expired ${check === "activation" ? "activation" : "verification"
      } code`
    );
};

const hashPass = async (newPassword) => {
  return await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));
};

const verifyFirebaseIdToken = async (idToken) => {
  try {
    // For development, accept any valid-looking token
    // In production, this should verify the actual Firebase token
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Invalid token format');
    }

    // Mock decoded token for development - replace with real Firebase verification in production
    const mockDecodedToken = {
      uid: 'dev-user-' + Math.random().toString(36).substr(2, 9),
      email: 'dev-user@example.com',
      name: 'Development User',
      firebase: {
        sign_in_provider: 'google.com' // or 'facebook.com'
      }
    };

    return mockDecodedToken;
  } catch (error) {
    throw new ApiError(status.UNAUTHORIZED, "Invalid social auth token");
  }
};

const checkStudentClassMembership = async (studentId) => {
  try {
    const classes = await Class.find({
      'students.studentId': studentId,
      'students.status': 'active',
      isActive: true
    }).select('_id name classCode').lean();

    return {
      isInClass: classes.length > 0,
      classCount: classes.length,
      classes: classes.map(cls => ({
        classId: cls._id,
        className: cls.name,
        classCode: cls.classCode
      }))
    };
  } catch (error) {
    logger.error('Error checking student class membership:', error);
    return {
      isInClass: false,
      classCount: 0,
      classes: []
    };
  }
};


const socialLogin = async (payload) => {
  const { accessToken, provider, role } = payload;

  // Validate required fields
  if (!accessToken) {
    throw new ApiError(status.BAD_REQUEST, "Access token is required");
  }
  if (!provider) {
    throw new ApiError(status.BAD_REQUEST, "Provider is required");
  }

  // Validate token with the respective provider and get user data
  const userData = await SocialAuthProviders.validateProviderToken(provider, accessToken);

  const { email, name, firstName, lastName, picture, providerId } = userData;

  // Find or create user by email
  let auth = await Auth.findOne({ email });

  if (auth) {
    // Update existing user
    if (auth.isBlocked) {
      throw new ApiError(status.FORBIDDEN, "Account blocked. Contact support");
    }

    // Ensure providers array contains provider
    const providers = new Set(auth.providers || []);
    providers.add(provider);
    auth.providers = Array.from(providers);

    // Update social provider ID if not exists
    if (!auth.socialProviderIds) auth.socialProviderIds = {};
    auth.socialProviderIds[provider] = providerId;

    if (!auth.isActive) auth.isActive = true;
    if (!auth.displayName && name) auth.displayName = name;
    if (picture && !auth.profilePicture) auth.profilePicture = picture;

    await auth.save();
  } else {
    // Create new user
    const newAuthData = {
      firstName: firstName || name?.split(' ')[0] || '',
      lastName: lastName || name?.split(' ').slice(1).join(' ') || '',
      email,
      role: role || EnumUserRole.STUDENT,
      isActive: true,
      isVerified: true,
      providers: [provider],
      displayName: name,
      profilePicture: picture,
      socialProviderIds: { [provider]: providerId }
    };

    auth = await Auth.create(newAuthData);
  }

  // Ensure profile exists in respective collection
  const profileData = {
    authId: auth._id,
    firstName: auth.firstName,
    lastName: auth.lastName,
    email: auth.email,
    profilePicture: auth.profilePicture
  };

  let profile;
  switch (auth.role) {
    case EnumUserRole.SUPER_ADMIN:
      profile = await SuperAdmin.findOne({ authId: auth._id }).lean();
      if (!profile) {
        await SuperAdmin.create(profileData);
      }
      break;
    case EnumUserRole.ADMIN:
      profile = await Admin.findOne({ authId: auth._id }).lean();
      if (!profile) {
        await Admin.create(profileData);
      }
      break;
    case EnumUserRole.STUDENT:
      profile = await Student.findOne({ authId: auth._id }).lean();
      if (!profile) {
        await Student.create(profileData);
      }
      break;
    case EnumUserRole.TEACHER:
      profile = await Teacher.findOne({ authId: auth._id }).lean();
      if (!profile) {
        await Teacher.create(profileData);
      }
      break;
    case EnumUserRole.SCHOOL:
      profile = await School.findOne({ authId: auth._id }).lean();
      if (!profile) {
        await School.create(profileData);
      }
      break;
    default:
      profile = null;
  }

  // Get final profile with populated data
  let result;
  switch (auth.role) {
    case EnumUserRole.SUPER_ADMIN:
      result = await SuperAdmin.findOne({ authId: auth._id }).lean();
      break;
    case EnumUserRole.ADMIN:
      result = await Admin.findOne({ authId: auth._id }).lean();
      break;
    case EnumUserRole.STUDENT:
      result = await Student.findOne({ authId: auth._id }).lean();
      break;
    case EnumUserRole.TEACHER:
      result = await Teacher.findOne({ authId: auth._id }).lean();
      break;
    case EnumUserRole.SCHOOL:
      result = await School.findOne({ authId: auth._id }).lean();
      break;
    default:
      result = null;
  }

  const tokenPayload = {
    authId: auth._id,
    userId: result ? result._id : null,
    email: auth.email,
    role: auth.role,
  };

  const jwtAccessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.secret,
    config.jwt.expires_in
  );
  const refreshToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.refresh_secret,
    config.jwt.refresh_expires_in
  );

  // Check if student is in any class and include this information
  let classMembershipInfo = {};
  if (auth.role === EnumUserRole.STUDENT && result) {
    classMembershipInfo = await checkStudentClassMembership(result._id);
  }

  return {
    user: result ? {
      ...result,
      ...classMembershipInfo
    } : {
      authId: auth._id,
      email: auth.email,
      firstName: auth.firstName,
      lastName: auth.lastName,
      profilePicture: auth.profilePicture
    },
    accessToken: jwtAccessToken,
    refreshToken,
    provider: provider
  };
};


// Unset activationCode activationCodeExpire field for expired activation code
// Unset isVerified, verificationCode, verificationCodeExpire field for expired verification code
cron.schedule("* * * * *", async () => {
  try {
    updateFieldsWithCron("activation");
    updateFieldsWithCron("verification");
  } catch (error) {
    logger.error("Error removing expired code:", error);
  }
});

const AuthService = {
  registrationAccount,
  loginAccount,
  changePassword,
  forgotPass,
  resetPassword,
  activateAccount,
  forgetPassOtpVerify,
  resendActivationCode,
  socialLogin,
};

module.exports = { AuthService };

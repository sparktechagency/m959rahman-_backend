const { status } = require("http-status");
const ApiError = require("../../../error/ApiError");
const schoolService = require("./school.service");

/**
 * Add a teacher to school
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleAddTeacherToSchool = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    const data = req.body;
    const authId = req.user?.authId;

    const teacher = await schoolService.addTeacherToSchool(data, schoolId, authId);

    res.status(201).json({
      success: true,
      message: "Teacher added to school successfully",
      data: teacher,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(status.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
};

/**
 * Get all teachers in a school
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleGetAllTeachersInSchool = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    const { page = 1, limit = 10 } = req.query;
    const query = { page, limit };

    const result = await schoolService.getAllTeachersInSchool(schoolId, query);

    res.status(200).json({
      success: true,
      message: "Teachers fetched successfully",
      meta: result.meta,
      data: result.teachers,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(status.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
};

/**
 * Get detailed information about a teacher in a school
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleGetTeacherDetails = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    const teacherId = req.params.teacherId;
    
    const teacherDetails = await schoolService.getTeacherDetails(schoolId, teacherId);

    res.status(200).json({
      success: true,
      message: "Teacher details fetched successfully",
      data: teacherDetails,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(status.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
};


const handleUpdateTeacherStatus = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    const teacherId = req.params.teacherId;
    const { status: newStatus } = req.body;

    const result = await schoolService.updateTeacherStatus(schoolId, teacherId, newStatus);

    const message = newStatus === "active" 
      ? "Teacher unblocked successfully" 
      : "Teacher blocked successfully";

    res.status(200).json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(status.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
};


const handleRemoveTeacherFromSchool = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    const teacherId = req.params.teacherId;

    const result = await schoolService.removeTeacherFromSchool(schoolId, teacherId);

    res.status(200).json({
      success: true,
      message: "Teacher removed from school successfully",
      data: result.data,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(status.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
};

const handleGetSchoolDashboardStats = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    
    const stats = await schoolService.getSchoolDashboardStats(schoolId);

    res.status(200).json({
      success: true,
      message: "Dashboard statistics fetched successfully",
      data: stats,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(status.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
};

const handleUpdateSchoolProfile = async (req, res) => {
  try {
    // Check if we're using the /my-profile endpoint or the /:schoolId/profile endpoint
    let schoolId;
    
    // If the schoolId is in the params, use that
    if (req.params.schoolId) {
      schoolId = req.params.schoolId;
    }
    // Otherwise, use the userId from the JWT token (for /my-profile endpoint)
    else {
      schoolId = req.user?.userId;
      
      if (!schoolId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: User ID not found in token",
          errorMessages: [{ path: "", message: "Unauthorized: User ID not found in token" }]
        });
      }
    }
    
    // Prepare update data from the form fields
    const updateData = { ...req.body };
    
    // Handle file uploads if present
    // Handle profile image upload
    if (req.files && req.files.profile_image && req.files.profile_image.length > 0) {
      // Get the uploaded file path
      const profileImagePath = req.files.profile_image[0].path.replace(/\\/g, '/'); // Fix for Windows path
      updateData.profile_image = profileImagePath;
    }
    
    // Handle cover image upload
    if (req.files && req.files.cover_image && req.files.cover_image.length > 0) {
      // Get the uploaded file path
      const coverImagePath = req.files.cover_image[0].path.replace(/\\/g, '/'); // Fix for Windows path
      updateData.cover_image = coverImagePath;
    }
    
    // Make sure we have some data to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data provided for update",
        errorMessages: [{ path: "", message: "No data provided for update" }]
      });
    }
    
    const updatedSchool = await schoolService.updateSchoolProfile(schoolId, updateData);
    
    res.status(200).json({
      success: true,
      message: "School profile updated successfully",
      data: updatedSchool
    });
  } catch (error) {
    // Check for multer errors
    if (error.name === 'MulterError') {
      const handleMulterError = require('../../../error/handleMulterError');
      const multerError = handleMulterError(error);
      
      return res.status(multerError.statusCode).json({
        success: false,
        message: multerError.message,
        errorMessages: multerError.errorMessages,
      });
    }
    
    // Handle ApiError
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorMessages: error.errorMessages,
      });
    } 
    
    // Handle generic errors
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating school profile',
      errorMessages: [{ path: "", message: error.message || 'Error updating school profile' }],
    });
  }
};

const handleGetSchoolProfile = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    
    const schoolProfile = await schoolService.getSchoolProfile(schoolId);
    
    res.status(200).json({
      success: true,
      message: "School profile fetched successfully",
      data: schoolProfile
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorMessages: error.errorMessages,
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Error fetching school profile',
        errorMessages: [{ path: "", message: error.message || 'Error fetching school profile' }],
      });
    }
  }
};

const handleGetMySchoolProfile = async (req, res) => {
  try {
    // Get the userId from the JWT token (added by auth middleware)
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found in token",
        errorMessages: [{ path: "", message: "Unauthorized: User ID not found in token" }]
      });
    }
    
    const schoolProfile = await schoolService.getMySchoolProfile(userId);
    
    res.status(200).json({
      success: true,
      message: "School profile fetched successfully",
      data: schoolProfile
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorMessages: error.errorMessages,
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Error fetching school profile',
        errorMessages: [{ path: "", message: error.message || 'Error fetching school profile' }],
      });
    }
  }
};

const handleGetAllSchools = async (req, res) => {
  try {
    const { query } = req;
    
    const { schools, meta } = await schoolService.getAllSchools(query);
    
    res.status(200).json({
      success: true,
      message: "Schools fetched successfully",
      data: schools,
      meta,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorMessages: error.errorMessages,
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Error fetching schools',
        errorMessages: [{ path: "", message: error.message || 'Error fetching schools' }],
      });
    }
  }
};

const handleGetSchoolDetails = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    
    const schoolDetails = await schoolService.getSchoolDetails(schoolId);
    
    res.status(200).json({
      success: true,
      message: "School details fetched successfully",
      data: schoolDetails
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorMessages: error.errorMessages,
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Error fetching school details',
        errorMessages: [{ path: "", message: error.message || 'Error fetching school details' }],
      });
    }
  }
};

const handleBlockUnblockSchool = async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    const isBlocked = req.body.isBlocked;
    
    const school = await schoolService.blockUnblockSchool(schoolId, isBlocked);
    
    res.status(200).json({
      success: true,
      message: "School blocked/unblocked successfully",
      data: school
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errorMessages: error.errorMessages,
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Error blocking/unblocking school',
        errorMessages: [{ path: "", message: error.message || 'Error blocking/unblocking school' }],
      });
    }
  }
};

module.exports = {
  addTeacherToSchool: handleAddTeacherToSchool,
  getAllTeachersInSchool: handleGetAllTeachersInSchool,
  getTeacherDetails: handleGetTeacherDetails,
  updateTeacherStatus: handleUpdateTeacherStatus,
  removeTeacherFromSchool: handleRemoveTeacherFromSchool,
  getSchoolDashboardStats: handleGetSchoolDashboardStats,
  updateSchoolProfile: handleUpdateSchoolProfile,
  getSchoolProfile: handleGetSchoolProfile,
  getMySchoolProfile: handleGetMySchoolProfile,
  getAllSchools: handleGetAllSchools,
  getSchoolDetails: handleGetSchoolDetails,
  blockUnblockSchool: handleBlockUnblockSchool
};
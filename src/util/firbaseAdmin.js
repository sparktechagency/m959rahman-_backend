const admin = require("firebase-admin");

// Simple Firebase initialization - just for development
if (!admin.apps.length) {
  try {
    // Try to initialize with service account if available
    admin.initializeApp({
      projectId: "math-book-dev", // You can change this
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.warn("Firebase Admin initialization skipped:", error.message);
  }
}

module.exports = admin;

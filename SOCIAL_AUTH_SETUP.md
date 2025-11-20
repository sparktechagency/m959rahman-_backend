# Social Authentication Setup Guide

This guide explains how to set up Google, Facebook, and Microsoft social authentication for your application.

## Overview

The improved social auth system provides:
- **Simplified Integration**: Easy token validation for multiple providers
- **Standardized Response**: Consistent user data format across all providers
- **Automatic User Management**: Creates/updates user profiles automatically
- **Profile Picture Support**: Automatically fetches and stores profile pictures
- **Provider Tracking**: Tracks which providers each user has used

## Supported Providers

- ✅ **Google OAuth 2.0**
- ✅ **Facebook Login**
- ✅ **Microsoft OAuth 2.0**
- 🔄 **Apple Sign-In** (prepared for future implementation)

## Environment Variables Setup

Add these variables to your `.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id
GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Apple OAuth (for future use)
APPLE_CLIENT_ID=com.app.myRvApp
```

## Provider Setup Instructions

### 1. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API and Google OAuth2 API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configure for your platforms:
   - **Web**: Add your domain to authorized origins
   - **Android**: Add your package name and SHA-1 fingerprint
   - **iOS**: Add your bundle ID

### 2. Facebook Login Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or select existing one
3. Add "Facebook Login" product
4. Configure Valid OAuth Redirect URIs
5. Get your App ID and App Secret from Settings → Basic

### 3. Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Create a new registration
4. Configure redirect URIs for your platforms
5. Go to "Certificates & secrets" to create a client secret
6. Note down Application (client) ID and client secret

## API Endpoints

### Generic Social Sign-In
```
POST /api/auth/social-signin
```

### Provider-Specific Endpoints
```
POST /api/auth/social-signin/google
POST /api/auth/social-signin/facebook
POST /api/auth/social-signin/microsoft
```

## Request Format

### For All Providers
```json
{
  "accessToken": "provider_access_token",
  "provider": "google|facebook|microsoft",
  "role": "STUDENT" // Optional, defaults to STUDENT
}
```

### Example Requests

#### Google Sign-In
```json
{
  "accessToken": "ya29.a0AfH6SMC...",
  "provider": "google",
  "role": "STUDENT"
}
```

#### Facebook Sign-In
```json
{
  "accessToken": "EAABwzLixnjYBAO...",
  "provider": "facebook",
  "role": "TEACHER"
}
```

#### Microsoft Sign-In
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "provider": "microsoft",
  "role": "ADMIN"
}
```

## Response Format

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Logged in via social provider",
  "data": {
    "user": {
      "_id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "profilePicture": "https://...",
      "authId": "auth_id",
      // Additional user fields based on role
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "provider": "google"
  }
}
```

## Client-Side Integration Examples

### React Native (Google)
```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: 'your_google_client_id',
  androidClientId: 'your_google_android_client_id',
  iosClientId: 'your_google_ios_client_id',
});

// Sign in and get access token
const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();
    
    // Send to your backend
    const response = await fetch('/api/auth/social-signin/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: tokens.accessToken,
        provider: 'google'
      })
    });
    
    const result = await response.json();
    // Handle successful login
  } catch (error) {
    console.error('Google Sign-In Error:', error);
  }
};
```

### React Native (Facebook)
```javascript
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';

const signInWithFacebook = async () => {
  try {
    const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
    
    if (result.isCancelled) return;
    
    const data = await AccessToken.getCurrentAccessToken();
    
    // Send to your backend
    const response = await fetch('/api/auth/social-signin/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: data.accessToken,
        provider: 'facebook'
      })
    });
    
    const authResult = await response.json();
    // Handle successful login
  } catch (error) {
    console.error('Facebook Sign-In Error:', error);
  }
};
```

## Installation

1. Install the new axios dependency:
```bash
npm install axios
```

2. Update your environment variables in `.env`

3. Restart your server

## Features

### Automatic User Management
- Creates user profiles automatically on first sign-in
- Updates existing users with new provider information
- Maintains provider history for each user

### Profile Picture Integration
- Automatically fetches profile pictures from social providers
- Stores picture URLs in user profiles
- Updates pictures only if not already set

### Provider Tracking
- Tracks which social providers each user has used
- Stores provider-specific user IDs
- Allows users to link multiple social accounts

### Error Handling
- Comprehensive error messages for invalid tokens
- Provider-specific error handling
- Graceful fallbacks for missing data

## Security Features

- **Token Validation**: Real-time validation with provider APIs
- **Email Verification**: Ensures email addresses are verified by providers
- **Account Linking**: Safely links multiple providers to same email
- **Blocked User Protection**: Prevents blocked users from signing in

## Troubleshooting

### Common Issues

1. **Invalid Token Error**
   - Ensure client-side is sending fresh access tokens
   - Check token expiration times
   - Verify provider configuration

2. **Email Permission Error (Facebook)**
   - Ensure your Facebook app requests email permission
   - User must grant email permission during sign-in

3. **Provider Configuration Error**
   - Verify all environment variables are set correctly
   - Check provider app configurations match your setup

### Debug Mode

For development, you can enable detailed logging by setting:
```env
NODE_ENV=development
```

This will provide more detailed error messages and logging information.

## Migration from Previous Version

If you're upgrading from the previous social auth implementation:

1. Update your client-side code to send `accessToken` instead of `idToken`
2. Add the `provider` field to your requests
3. Update environment variables as shown above
4. Install axios dependency
5. Test with each provider to ensure proper functionality

The new system is backward compatible but provides much better validation and user experience.

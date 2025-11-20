const axios = require('axios');
const ApiError = require('../error/ApiError');
const { status } = require('http-status');

/**
 * Social Auth Providers - Simplified approach for easy integration
 * Each provider validates tokens and returns standardized user data
 */

class SocialAuthProviders {
  
  /**
   * Google OAuth Token Validation
   * @param {string} accessToken - Google access token from client
   * @returns {Object} - Standardized user data
   */
  static async validateGoogleToken(accessToken) {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );
      
      const { id, email, name, given_name, family_name, picture, verified_email } = response.data;
      
      if (!verified_email) {
        throw new ApiError(status.BAD_REQUEST, 'Google email not verified');
      }
      
      return {
        providerId: id,
        email,
        name,
        firstName: given_name || '',
        lastName: family_name || '',
        picture,
        provider: 'google',
        isEmailVerified: verified_email
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new ApiError(status.UNAUTHORIZED, 'Invalid Google access token');
      }
      throw new ApiError(status.BAD_REQUEST, 'Google authentication failed');
    }
  }

  /**
   * Facebook OAuth Token Validation
   * @param {string} accessToken - Facebook access token from client
   * @returns {Object} - Standardized user data
   */
  static async validateFacebookToken(accessToken) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email,first_name,last_name,picture&access_token=${accessToken}`
      );
      
      const { id, email, name, first_name, last_name, picture } = response.data;
      
      if (!email) {
        throw new ApiError(status.BAD_REQUEST, 'Facebook email permission required');
      }
      
      return {
        providerId: id,
        email,
        name,
        firstName: first_name || '',
        lastName: last_name || '',
        picture: picture?.data?.url,
        provider: 'facebook',
        isEmailVerified: true // Facebook emails are generally verified
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new ApiError(status.UNAUTHORIZED, 'Invalid Facebook access token');
      }
      throw new ApiError(status.BAD_REQUEST, 'Facebook authentication failed');
    }
  }

  /**
   * Microsoft OAuth Token Validation
   * @param {string} accessToken - Microsoft access token from client
   * @returns {Object} - Standardized user data
   */
  static async validateMicrosoftToken(accessToken) {
    try {
      const response = await axios.get(
        'https://graph.microsoft.com/v1.0/me',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      const { id, mail, displayName, givenName, surname, userPrincipalName } = response.data;
      
      const email = mail || userPrincipalName;
      if (!email) {
        throw new ApiError(status.BAD_REQUEST, 'Microsoft email not available');
      }
      
      return {
        providerId: id,
        email,
        name: displayName,
        firstName: givenName || '',
        lastName: surname || '',
        picture: null, // Microsoft Graph requires separate call for photo
        provider: 'microsoft',
        isEmailVerified: true
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new ApiError(status.UNAUTHORIZED, 'Invalid Microsoft access token');
      }
      throw new ApiError(status.BAD_REQUEST, 'Microsoft authentication failed');
    }
  }

  /**
   * Validate token based on provider
   * @param {string} provider - Provider name (google, facebook, microsoft)
   * @param {string} accessToken - Access token from client
   * @returns {Object} - Standardized user data
   */
  static async validateProviderToken(provider, accessToken) {
    switch (provider.toLowerCase()) {
      case 'google':
        return await this.validateGoogleToken(accessToken);
      case 'facebook':
        return await this.validateFacebookToken(accessToken);
      case 'microsoft':
        return await this.validateMicrosoftToken(accessToken);
      default:
        throw new ApiError(status.BAD_REQUEST, `Unsupported provider: ${provider}`);
    }
  }
}

module.exports = SocialAuthProviders;

import UserPrivacy from '../models/UserPrivacyModel.js';
import User from '../models/UserModel.js';

export class PrivacyService {
  // Get user's privacy settings
  static async getPrivacySettings(userId) {
    try {
      let privacySettings = await UserPrivacy.findOne({ userId });
      
      // If no privacy settings exist, create default ones
      if (!privacySettings) {
        privacySettings = await UserPrivacy.create({
          userId,
          showInLeaderboard: true,
          showRealName: false,
          shareProgressWithEducators: true,
          allowAnonymousAnalytics: true,
          dataRetentionPeriod: '2years',
          profileVisibility: 'educators'
        });
      }
      
      return privacySettings;
    } catch (error) {
      console.error('Error getting privacy settings:', error);
      throw new Error('Failed to retrieve privacy settings');
    }
  }

  // Update user's privacy settings
  static async updatePrivacySettings(userId, settings) {
    try {
      const updatedSettings = await UserPrivacy.findOneAndUpdate(
        { userId },
        { 
          ...settings,
          updatedAt: new Date()
        },
        { 
          new: true, 
          upsert: true,
          runValidators: true
        }
      );
      
      return updatedSettings;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw new Error('Failed to update privacy settings');
    }
  }

  // Get anonymized user data for leaderboards
  static async getAnonymizedUserData(userId) {
    try {
      const privacySettings = await this.getPrivacySettings(userId);
      const user = await User.findById(userId).select('username email');
      
      if (!privacySettings.showInLeaderboard) {
        return null; // User opted out of leaderboards
      }
      
      return {
        userId,
        displayName: privacySettings.showRealName ? user.username : null,
        isAnonymous: !privacySettings.showRealName,
        profileVisibility: privacySettings.profileVisibility
      };
    } catch (error) {
      console.error('Error getting anonymized user data:', error);
      throw new Error('Failed to get anonymized user data');
    }
  }

  // Export user data (GDPR compliance)
  static async exportUserData(userId, exportType = 'all') {
    try {
      const user = await User.findById(userId).select('-password');
      const privacySettings = await this.getPrivacySettings(userId);
      
      let exportData = {
        exportInfo: {
          userId,
          exportType,
          exportedAt: new Date().toISOString(),
          dataVersion: '1.0'
        }
      };

      if (exportType === 'all' || exportType === 'profile') {
        exportData.profile = {
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
      }

      if (exportType === 'all' || exportType === 'privacy') {
        exportData.privacySettings = {
          showInLeaderboard: privacySettings.showInLeaderboard,
          showRealName: privacySettings.showRealName,
          shareProgressWithEducators: privacySettings.shareProgressWithEducators,
          allowAnonymousAnalytics: privacySettings.allowAnonymousAnalytics,
          dataRetentionPeriod: privacySettings.dataRetentionPeriod,
          profileVisibility: privacySettings.profileVisibility,
          lastUpdated: privacySettings.updatedAt
        };
      }

      // TODO: Add progress data, session data, etc. based on exportType
      if (exportType === 'all' || exportType === 'progress') {
        exportData.progress = {
          note: 'Progress data would be included here from performance metrics'
        };
      }

      if (exportType === 'all' || exportType === 'sessions') {
        exportData.sessions = {
          note: 'Session data would be included here from simulation sessions'
        };
      }

      return exportData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  // Delete user data (GDPR right to be forgotten)
  static async deleteUserData(userId) {
    try {
      // Delete privacy settings
      await UserPrivacy.deleteOne({ userId });
      
      // TODO: Delete other user-related data
      // - Performance metrics
      // - Session data
      // - Progress data
      
      console.log(`Privacy data deleted for user ${userId}`);
      return { success: true, message: 'Privacy data deleted successfully' };
    } catch (error) {
      console.error('Error deleting user data:', error);
      throw new Error('Failed to delete user data');
    }
  }

  // Get privacy statistics for admin
  static async getPrivacyStatistics() {
    try {
      const totalUsers = await User.countDocuments();
      const privacySettings = await UserPrivacy.find();
      
      const stats = {
        totalUsers,
        usersWithPrivacySettings: privacySettings.length,
        leaderboardOptIns: privacySettings.filter(p => p.showInLeaderboard).length,
        realNameSharing: privacySettings.filter(p => p.showRealName).length,
        educatorSharing: privacySettings.filter(p => p.shareProgressWithEducators).length,
        analyticsOptIns: privacySettings.filter(p => p.allowAnonymousAnalytics).length,
        profileVisibilityBreakdown: {
          public: privacySettings.filter(p => p.profileVisibility === 'public').length,
          educators: privacySettings.filter(p => p.profileVisibility === 'educators').length,
          private: privacySettings.filter(p => p.profileVisibility === 'private').length
        }
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting privacy statistics:', error);
      throw new Error('Failed to get privacy statistics');
    }
  }
}

export default PrivacyService;
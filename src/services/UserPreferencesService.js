import User from '../models/UserModel.js';
import mongoose from 'mongoose';

/**
 * User Preferences Service
 * Handles user customization, personalization, and accessibility features
 */
class UserPreferencesService {
  constructor() {
    this.themes = {
      LIGHT: 'light',
      DARK: 'dark',
      HIGH_CONTRAST: 'high_contrast',
      BLUE_LIGHT_FILTER: 'blue_light_filter'
    };

    this.layouts = {
      COMPACT: 'compact',
      SPACIOUS: 'spacious',
      FOCUSED: 'focused',
      MULTI_PANEL: 'multi_panel'
    };

    this.fontSizes = {
      SMALL: 'small',
      MEDIUM: 'medium',
      LARGE: 'large',
      EXTRA_LARGE: 'extra_large'
    };

    this.notificationChannels = {
      EMAIL: 'email',
      PUSH: 'push',
      IN_APP: 'in_app',
      SMS: 'sms'
    };

    this.accessibilityFeatures = {
      SCREEN_READER: 'screen_reader',
      KEYBOARD_NAVIGATION: 'keyboard_navigation',
      REDUCED_MOTION: 'reduced_motion',
      COLOR_BLIND_MODE: 'color_blind_mode',
      DYSLEXIA_FONT: 'dyslexia_font'
    };
  }

  /**
   * Get user preferences
   * @param {Object} user - User object
   * @returns {Promise<Object>} - User preferences
   */
  async getUserPreferences(user) {
    try {
      const preferences = await mongoose.connection.db.collection('user_preferences')
        .findOne({ user_id: user._id });

      if (!preferences) {
        return this.getDefaultPreferences(user);
      }

      return preferences;
    } catch (error) {
      console.error('Get user preferences error:', error);
      throw error;
    }
  }

  /**
   * Get default preferences for a user
   */
  getDefaultPreferences(user) {
    return {
      user_id: user._id,
      theme: this.themes.LIGHT,
      layout: this.layouts.FOCUSED,
      fontSize: this.fontSizes.MEDIUM,
      language: 'en',
      timezone: 'UTC',
      notifications: {
        enabled: true,
        channels: [this.notificationChannels.IN_APP],
        types: {
          assignment_reminders: true,
          deadline_alerts: true,
          performance_updates: true,
          new_content: false,
          forum_replies: true,
          emergency_alerts: true
        },
        quiet_hours: {
          enabled: false,
          start_time: '22:00',
          end_time: '06:00'
        }
      },
      accessibility: {
        enabled_features: [],
        high_contrast_mode: false,
        reduced_motion: false,
        screen_reader_support: false,
        keyboard_shortcuts: true
      },
      learning_goals: {
        daily_target_minutes: 60,
        weekly_target_days: 5,
        competency_mastery_level: 80,
        auto_adjust_goals: true
      },
      interface: {
        show_progress_bars: true,
        show_competency_levels: true,
        show_time_tracking: true,
        show_suggested_content: true,
        show_peer_comparison: false,
        show_leaderboard: true
      },
      content_preferences: {
        preferred_difficulty: 'adaptive',
        content_types: ['video', 'text', 'interactive'],
        learning_style: null,
        auto_play_videos: false,
        download_for_offline: true
      },
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  /**
   * Update user preferences
   * @param {Object} user - User object
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateUserPreferences(user, updates) {
    try {
      const existingPreferences = await this.getUserPreferences(user);
      const mergedPreferences = { ...existingPreferences, ...updates, updated_at: new Date() };

      await mongoose.connection.db.collection('user_preferences').updateOne(
        { user_id: user._id },
        { $set: mergedPreferences },
        { upsert: true }
      );

      return mergedPreferences;
    } catch (error) {
      console.error('Update user preferences error:', error);
      throw error;
    }
  }

  /**
   * Reset user preferences to defaults
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Default preferences
   */
  async resetToDefaults(user) {
    try {
      const defaultPreferences = this.getDefaultPreferences(user);
      await mongoose.connection.db.collection('user_preferences').updateOne(
        { user_id: user._id },
        { $set: defaultPreferences },
        { upsert: true }
      );
      return defaultPreferences;
    } catch (error) {
      console.error('Reset preferences error:', error);
      throw error;
    }
  }

  /**
   * Update theme preference
   * @param {Object} user - User object
   * @param {string} theme - Theme identifier
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateTheme(user, theme) {
    if (!Object.values(this.themes).includes(theme)) {
      throw new Error('Invalid theme specified');
    }

    return this.updateUserPreferences(user, { theme });
  }

  /**
   * Update layout preference
   * @param {Object} user - User object
   * @param {string} layout - Layout identifier
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateLayout(user, layout) {
    if (!Object.values(this.layouts).includes(layout)) {
      throw new Error('Invalid layout specified');
    }

    return this.updateUserPreferences(user, { layout });
  }

  /**
   * Update font size preference
   * @param {Object} user - User object
   * @param {string} fontSize - Font size identifier
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateFontSize(user, fontSize) {
    if (!Object.values(this.fontSizes).includes(fontSize)) {
      throw new Error('Invalid font size specified');
    }

    return this.updateUserPreferences(user, { fontSize });
  }

  /**
   * Update notification preferences
   * @param {Object} user - User object
   * @param {Object} notificationUpdates - Notification settings updates
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateNotificationPreferences(user, notificationUpdates) {
    const currentPreferences = await this.getUserPreferences(user);
    const updatedNotifications = { ...currentPreferences.notifications, ...notificationUpdates };
    return this.updateUserPreferences(user, { notifications: updatedNotifications });
  }

  /**
   * Update accessibility features
   * @param {Object} user - User object
   * @param {Object} accessibilityUpdates - Accessibility settings updates
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateAccessibilityFeatures(user, accessibilityUpdates) {
    const currentPreferences = await this.getUserPreferences(user);
    const updatedAccessibility = { ...currentPreferences.accessibility, ...accessibilityUpdates };
    return this.updateUserPreferences(user, { accessibility: updatedAccessibility });
  }

  /**
   * Update learning goals
   * @param {Object} user - User object
   * @param {Object} goalUpdates - Learning goal updates
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateLearningGoals(user, goalUpdates) {
    const currentPreferences = await this.getUserPreferences(user);
    const updatedGoals = { ...currentPreferences.learning_goals, ...goalUpdates };
    return this.updateUserPreferences(user, { learning_goals: updatedGoals });
  }

  /**
   * Update interface preferences
   * @param {Object} user - User object
   * @param {Object} interfaceUpdates - Interface settings updates
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateInterfacePreferences(user, interfaceUpdates) {
    const currentPreferences = await this.getUserPreferences(user);
    const updatedInterface = { ...currentPreferences.interface, ...interfaceUpdates };
    return this.updateUserPreferences(user, { interface: updatedInterface });
  }

  /**
   * Update content preferences
   * @param {Object} user - User object
   * @param {Object} contentUpdates - Content preference updates
   * @returns {Promise<Object>} - Updated preferences
   */
  async updateContentPreferences(user, contentUpdates) {
    const currentPreferences = await this.getUserPreferences(user);
    const updatedContent = { ...currentPreferences.content_preferences, ...contentUpdates };
    return this.updateUserPreferences(user, { content_preferences: updatedContent });
  }

  /**
   * Enable accessibility feature
   * @param {Object} user - User object
   * @param {string} feature - Accessibility feature to enable
   * @returns {Promise<Object>} - Updated preferences
   */
  async enableAccessibilityFeature(user, feature) {
    if (!Object.values(this.accessibilityFeatures).includes(feature)) {
      throw new Error('Invalid accessibility feature specified');
    }

    const currentPreferences = await this.getUserPreferences(user);
    const enabledFeatures = [...new Set([...currentPreferences.accessibility.enabled_features, feature])];
    const updatedAccessibility = { ...currentPreferences.accessibility, enabled_features: enabledFeatures };

    // Set specific flags based on feature
    switch (feature) {
      case this.accessibilityFeatures.SCREEN_READER:
        updatedAccessibility.screen_reader_support = true;
        break;
      case this.accessibilityFeatures.REDUCED_MOTION:
        updatedAccessibility.reduced_motion = true;
        break;
      case this.accessibilityFeatures.COLOR_BLIND_MODE:
        updatedAccessibility.high_contrast_mode = true;
        break;
    }

    return this.updateUserPreferences(user, { accessibility: updatedAccessibility });
  }

  /**
   * Disable accessibility feature
   * @param {Object} user - User object
   * @param {string} feature - Accessibility feature to disable
   * @returns {Promise<Object>} - Updated preferences
   */
  async disableAccessibilityFeature(user, feature) {
    const currentPreferences = await this.getUserPreferences(user);
    const enabledFeatures = currentPreferences.accessibility.enabled_features.filter(f => f !== feature);
    const updatedAccessibility = { ...currentPreferences.accessibility, enabled_features: enabledFeatures };

    // Clear specific flags based on feature
    switch (feature) {
      case this.accessibilityFeatures.SCREEN_READER:
        updatedAccessibility.screen_reader_support = false;
        break;
      case this.accessibilityFeatures.REDUCED_MOTION:
        updatedAccessibility.reduced_motion = false;
        break;
      case this.accessibilityFeatures.COLOR_BLIND_MODE:
        updatedAccessibility.high_contrast_mode = false;
        break;
    }

    return this.updateUserPreferences(user, { accessibility: updatedAccessibility });
  }

  /**
   * Get personalized user settings for frontend
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Frontend-friendly preferences
   */
  async getFrontendPreferences(user) {
    const preferences = await this.getUserPreferences(user);
    
    return {
      theme: preferences.theme,
      layout: preferences.layout,
      fontSize: preferences.fontSize,
      language: preferences.language,
      timezone: preferences.timezone,
      notifications: preferences.notifications,
      accessibility: preferences.accessibility,
      learningGoals: preferences.learning_goals,
      interface: preferences.interface,
      content: preferences.content_preferences
    };
  }

  /**
   * Apply user preferences to content delivery
   * @param {Object} user - User object
   * @param {Array} contentList - List of content items
   * @returns {Promise<Array>} - Filtered and sorted content based on preferences
   */
  async applyContentPreferences(user, contentList) {
    const preferences = await this.getUserPreferences(user);
    const contentPreferences = preferences.content_preferences;

    let filteredContent = contentList.filter(content => {
      // Filter by preferred content types
      if (contentPreferences.content_types && contentPreferences.content_types.length > 0) {
        return contentPreferences.content_types.includes(content.type);
      }
      return true;
    });

    // Sort by preferred difficulty if not adaptive
    if (contentPreferences.preferred_difficulty !== 'adaptive') {
      filteredContent.sort((a, b) => {
        const difficultyOrder = { 'easy': 1, 'medium': 2, 'hard': 3, 'expert': 4 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      });
    }

    // Apply learning style preferences if available
    if (contentPreferences.learning_style) {
      filteredContent = this.prioritizeByLearningStyle(filteredContent, contentPreferences.learning_style);
    }

    return filteredContent;
  }

  /**
   * Prioritize content based on learning style
   */
  prioritizeByLearningStyle(contentList, learningStyle) {
    const styleWeights = {
      visual: { video: 2, image: 2, interactive: 1, text: 0.5 },
      auditory: { audio: 2, video: 1.5, interactive: 1, text: 0.5 },
      kinesthetic: { interactive: 2, video: 1, audio: 0.5, text: 0.5 },
      reading_writing: { text: 2, interactive: 1, video: 0.5, audio: 0.5 }
    };

    const weights = styleWeights[learningStyle] || styleWeights.visual;

    return contentList.map(content => {
      const weight = weights[content.type] || 1;
      return { ...content, preferenceWeight: weight };
    }).sort((a, b) => b.preferenceWeight - a.preferenceWeight);
  }

  /**
   * Generate CSS custom properties for user theme
   * @param {Object} user - User object
   * @returns {Promise<string>} - CSS custom properties string
   */
  async generateThemeCSS(user) {
    const preferences = await this.getUserPreferences(user);
    
    const themeVariables = {
      [this.themes.LIGHT]: {
        '--primary-color': '#007bff',
        '--secondary-color': '#6c757d',
        '--background-color': '#ffffff',
        '--text-color': '#212529',
        '--border-color': '#dee2e6'
      },
      [this.themes.DARK]: {
        '--primary-color': '#0d6efd',
        '--secondary-color': '#6c757d',
        '--background-color': '#121212',
        '--text-color': '#f8f9fa',
        '--border-color': '#495057'
      },
      [this.themes.HIGH_CONTRAST]: {
        '--primary-color': '#0000ff',
        '--secondary-color': '#ffff00',
        '--background-color': '#000000',
        '--text-color': '#ffffff',
        '--border-color': '#ffffff'
      },
      [this.themes.BLUE_LIGHT_FILTER]: {
        '--primary-color': '#0056b3',
        '--secondary-color': '#5a6268',
        '--background-color': '#fffaf0',
        '--text-color': '#2c3e50',
        '--border-color': '#d6d8db'
      }
    };

    const fontSizeMultipliers = {
      [this.fontSizes.SMALL]: 0.9,
      [this.fontSizes.MEDIUM]: 1,
      [this.fontSizes.LARGE]: 1.2,
      [this.fontSizes.EXTRA_LARGE]: 1.4
    };

    const theme = themeVariables[preferences.theme] || themeVariables[this.themes.LIGHT];
    const fontSizeMultiplier = fontSizeMultipliers[preferences.fontSize] || 1;

    let css = ':root {\n';
    Object.entries(theme).forEach(([key, value]) => {
      css += `  ${key}: ${value};\n`;
    });
    css += `  --font-size-multiplier: ${fontSizeMultiplier};\n`;
    css += '}';

    return css;
  }

  /**
   * Validate preference updates
   * @param {Object} updates - Preference updates to validate
   * @returns {Array} - Array of validation errors, empty if valid
   */
  validatePreferences(updates) {
    const errors = [];

    if (updates.theme && !Object.values(this.themes).includes(updates.theme)) {
      errors.push('Invalid theme value');
    }

    if (updates.layout && !Object.values(this.layouts).includes(updates.layout)) {
      errors.push('Invalid layout value');
    }

    if (updates.fontSize && !Object.values(this.fontSizes).includes(updates.fontSize)) {
      errors.push('Invalid font size value');
    }

    if (updates.notifications && typeof updates.notifications !== 'object') {
      errors.push('Notifications must be an object');
    }

    if (updates.accessibility && typeof updates.accessibility !== 'object') {
      errors.push('Accessibility must be an object');
    }

    return errors;
  }
}

export default new UserPreferencesService();
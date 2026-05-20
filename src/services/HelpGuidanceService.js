import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import mongoose from 'mongoose';

/**
 * Help and Guidance Service
 * Provides contextual help, tutorials, and guidance for students
 */
class HelpGuidanceService {
  constructor() {
    this.helpCategories = {
      getting_started: {
        name: 'Getting Started',
        icon: 'play-circle',
        description: 'Learn the basics of using the platform'
      },
      case_navigation: {
        name: 'Case Navigation',
        icon: 'compass',
        description: 'How to navigate and complete cases'
      },
      progress_tracking: {
        name: 'Progress Tracking',
        icon: 'chart-line',
        description: 'Understanding your progress and achievements'
      },
      technical_support: {
        name: 'Technical Support',
        icon: 'tools',
        description: 'Technical issues and troubleshooting'
      },
      academic_support: {
        name: 'Academic Support',
        icon: 'graduation-cap',
        description: 'Learning strategies and academic guidance'
      }
    };

    this.tutorials = [
      {
        id: 'platform_overview',
        title: 'Platform Overview',
        category: 'getting_started',
        duration: 5,
        steps: [
          'Welcome to the healthcare simulation platform',
          'Navigate your personalized dashboard',
          'Understand your discipline-specific interface',
          'Explore available cases and recommendations',
          'Track your progress and achievements'
        ]
      },
      {
        id: 'first_case',
        title: 'Completing Your First Case',
        category: 'case_navigation',
        duration: 10,
        steps: [
          'Select a recommended case',
          'Read the patient presentation',
          'Gather information and ask questions',
          'Make clinical decisions',
          'Review feedback and learn from results'
        ]
      },
      {
        id: 'progress_understanding',
        title: 'Understanding Your Progress',
        category: 'progress_tracking',
        duration: 7,
        steps: [
          'View your competency scores',
          'Understand achievement badges',
          'Track your learning path',
          'Set personal goals',
          'Use analytics to improve'
        ]
      }
    ];

    this.faqItems = [
      {
        id: 'how_to_start',
        question: 'How do I start my first case?',
        answer: 'Go to your dashboard and click on "Start New Case" or select from the recommended cases. Choose a case that matches your current level and interests.',
        category: 'getting_started',
        tags: ['cases', 'beginner', 'start']
      },
      {
        id: 'scoring_system',
        question: 'How does the scoring system work?',
        answer: 'Cases are scored based on multiple competencies including clinical reasoning, knowledge application, and communication skills. Scores range from 0-100, with detailed feedback provided.',
        category: 'progress_tracking',
        tags: ['scoring', 'assessment', 'feedback']
      },
      {
        id: 'retake_cases',
        question: 'Can I retake cases to improve my score?',
        answer: 'Yes! You can retake any case to improve your understanding and score. Each attempt is tracked, and you can see your progress over time.',
        category: 'case_navigation',
        tags: ['retake', 'improvement', 'practice']
      },
      {
        id: 'technical_issues',
        question: 'What should I do if I encounter technical issues?',
        answer: 'First, try refreshing your browser. If the issue persists, check our troubleshooting guide or contact technical support through the help desk.',
        category: 'technical_support',
        tags: ['technical', 'troubleshooting', 'support']
      },
      {
        id: 'study_strategies',
        question: 'What are some effective study strategies?',
        answer: 'Focus on understanding concepts rather than memorization. Use the feedback from cases to identify weak areas. Practice regularly and review your progress analytics.',
        category: 'academic_support',
        tags: ['study', 'learning', 'strategies']
      }
    ];
  }

  /**
   * Get contextual help based on user's current context
   * @param {Object} user - User object
   * @param {Object} context - Current context (page, case, etc.)
   * @returns {Promise<Object>} - Contextual help data
   */
  async getContextualHelp(user, context = {}) {
    try {
      const { page, caseId, difficulty } = context;
      const discipline = user.profile?.discipline || 'medicine';
      
      let helpItems = [];
      let quickTips = [];
      let relatedTutorials = [];

      // Dashboard context
      if (page === 'dashboard') {
        helpItems = [
          {
            title: 'Understanding Your Dashboard',
            content: 'Your dashboard shows personalized recommendations, progress summary, and quick actions tailored to your discipline.',
            type: 'tip'
          },
          {
            title: 'Getting Started',
            content: 'New to the platform? Start with the recommended cases or take the platform overview tutorial.',
            type: 'suggestion'
          }
        ];
        
        quickTips = [
          'Check your recommended cases daily for personalized learning',
          'Track your study streak to maintain consistent learning',
          'Review your competency scores to identify improvement areas'
        ];
        
        relatedTutorials = this.tutorials.filter(t => 
          t.category === 'getting_started' || t.category === 'progress_tracking'
        );
      }

      // Case context
      if (page === 'case' && caseId) {
        const caseDoc = await Case.findById(caseId).lean();
        if (caseDoc) {
          helpItems = [
            {
              title: 'Case Navigation Tips',
              content: 'Take your time to read the patient presentation carefully. Ask relevant questions and think through your clinical reasoning.',
              type: 'tip'
            },
            {
              title: 'Making Decisions',
              content: 'Consider all available information before making decisions. Remember, this is a learning environment - explore different approaches.',
              type: 'guidance'
            }
          ];

          if (difficulty === 'beginner') {
            quickTips.push('This is a beginner case - focus on fundamental concepts and basic clinical reasoning');
          } else if (difficulty === 'advanced') {
            quickTips.push('This advanced case requires complex reasoning - consider multiple differential diagnoses');
          }
        }
        
        relatedTutorials = this.tutorials.filter(t => t.category === 'case_navigation');
      }

      // Progress context
      if (page === 'progress') {
        helpItems = [
          {
            title: 'Interpreting Your Scores',
            content: 'Competency scores show your strength in different areas. Focus on areas below 75% for improvement.',
            type: 'explanation'
          },
          {
            title: 'Setting Goals',
            content: 'Use your progress data to set realistic learning goals. Aim for consistent improvement rather than perfection.',
            type: 'advice'
          }
        ];
        
        relatedTutorials = this.tutorials.filter(t => t.category === 'progress_tracking');
      }

      return {
        contextualHelp: helpItems,
        quickTips,
        relatedTutorials,
        discipline,
        context
      };
    } catch (error) {
      console.error('Get contextual help error:', error);
      throw error;
    }
  }

  /**
   * Search help content
   * @param {string} query - Search query
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Search results
   */
  async searchHelp(query, user) {
    try {
      const searchTerm = query.toLowerCase();
      
      // Search FAQ items
      const faqResults = this.faqItems.filter(item => 
        item.question.toLowerCase().includes(searchTerm) ||
        item.answer.toLowerCase().includes(searchTerm) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );

      // Search tutorials
      const tutorialResults = this.tutorials.filter(tutorial =>
        tutorial.title.toLowerCase().includes(searchTerm) ||
        tutorial.steps.some(step => step.toLowerCase().includes(searchTerm))
      );

      // Get related categories
      const relatedCategories = [...new Set([
        ...faqResults.map(item => item.category),
        ...tutorialResults.map(tutorial => tutorial.category)
      ])].map(categoryId => ({
        id: categoryId,
        ...this.helpCategories[categoryId]
      }));

      return {
        query,
        results: {
          faq: faqResults,
          tutorials: tutorialResults,
          categories: relatedCategories
        },
        totalResults: faqResults.length + tutorialResults.length
      };
    } catch (error) {
      console.error('Search help error:', error);
      throw error;
    }
  }

  /**
   * Get help by category
   * @param {string} categoryId - Category ID
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Category help content
   */
  async getHelpByCategory(categoryId, user) {
    try {
      const category = this.helpCategories[categoryId];
      if (!category) {
        throw new Error('Category not found');
      }

      const faqItems = this.faqItems.filter(item => item.category === categoryId);
      const tutorials = this.tutorials.filter(tutorial => tutorial.category === categoryId);

      return {
        category: {
          id: categoryId,
          ...category
        },
        faqItems,
        tutorials,
        totalItems: faqItems.length + tutorials.length
      };
    } catch (error) {
      console.error('Get help by category error:', error);
      throw error;
    }
  }

  /**
   * Get tutorial by ID
   * @param {string} tutorialId - Tutorial ID
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Tutorial details
   */
  async getTutorial(tutorialId, user) {
    try {
      const tutorial = this.tutorials.find(t => t.id === tutorialId);
      if (!tutorial) {
        throw new Error('Tutorial not found');
      }

      const category = this.helpCategories[tutorial.category];

      return {
        ...tutorial,
        category: {
          id: tutorial.category,
          ...category
        }
      };
    } catch (error) {
      console.error('Get tutorial error:', error);
      throw error;
    }
  }

  /**
   * Get personalized guidance based on student progress
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Personalized guidance
   */
  async getPersonalizedGuidance(user) {
    try {
      const discipline = user.profile?.discipline || 'medicine';
      
      // Get student's recent performance
      const recentAttempts = await mongoose.connection.db.collection('case_attempts').find({
        user_id: user._id,
        status: 'completed'
      }).sort({ start_time: -1 }).limit(10).toArray();

      const guidance = {
        recommendations: [],
        studyTips: [],
        nextSteps: [],
        motivationalMessage: ''
      };

      if (recentAttempts.length === 0) {
        // New student guidance
        guidance.recommendations = [
          'Start with beginner-level cases to build confidence',
          'Take the platform overview tutorial',
          'Set up your learning goals and preferences'
        ];
        
        guidance.studyTips = [
          'Spend time reading patient presentations carefully',
          'Don\'t rush - learning is more important than speed',
          'Review feedback after each case attempt'
        ];
        
        guidance.motivationalMessage = 'Welcome to your learning journey! Take your time to explore and don\'t hesitate to ask for help.';
      } else {
        // Analyze performance and provide targeted guidance
        const averageScore = recentAttempts.reduce((sum, attempt) => 
          sum + (attempt.score?.overall || 0), 0) / recentAttempts.length;

        if (averageScore < 60) {
          guidance.recommendations = [
            'Focus on fundamental concepts in your discipline',
            'Review basic clinical reasoning principles',
            'Consider retaking recent cases to reinforce learning'
          ];
          
          guidance.studyTips = [
            'Break down complex cases into smaller components',
            'Use additional learning resources for weak areas',
            'Practice regularly with easier cases first'
          ];
        } else if (averageScore < 80) {
          guidance.recommendations = [
            'Challenge yourself with intermediate-level cases',
            'Focus on improving weaker competency areas',
            'Explore cases outside your comfort zone'
          ];
          
          guidance.studyTips = [
            'Analyze your mistakes to understand patterns',
            'Set specific improvement goals for each competency',
            'Practice time management during case completion'
          ];
        } else {
          guidance.recommendations = [
            'Take on advanced and complex cases',
            'Mentor other students or participate in discussions',
            'Explore interdisciplinary cases'
          ];
          
          guidance.studyTips = [
            'Focus on clinical reasoning and decision-making speed',
            'Challenge yourself with rare or complex scenarios',
            'Consider real-world application of your knowledge'
          ];
        }

        guidance.motivationalMessage = averageScore >= 80 
          ? 'Excellent progress! You\'re demonstrating strong competency in your field.'
          : averageScore >= 60
          ? 'Good work! You\'re making steady progress. Keep focusing on your improvement areas.'
          : 'Keep going! Every expert was once a beginner. Focus on understanding concepts deeply.';
      }

      // Add discipline-specific guidance
      guidance.nextSteps = this.getDisciplineSpecificGuidance(discipline, recentAttempts);

      return guidance;
    } catch (error) {
      console.error('Get personalized guidance error:', error);
      throw error;
    }
  }

  /**
   * Get all help categories
   * @returns {Object} - All help categories
   */
  getHelpCategories() {
    return Object.keys(this.helpCategories).map(id => ({
      id,
      ...this.helpCategories[id]
    }));
  }

  /**
   * Get discipline-specific guidance
   */
  getDisciplineSpecificGuidance(discipline, recentAttempts) {
    const disciplineGuidance = {
      medicine: [
        'Practice differential diagnosis skills',
        'Focus on patient history taking',
        'Develop clinical reasoning patterns'
      ],
      nursing: [
        'Master patient care planning',
        'Practice medication administration safety',
        'Develop patient communication skills'
      ],
      laboratory: [
        'Focus on quality control procedures',
        'Practice result interpretation',
        'Master safety protocols'
      ],
      radiology: [
        'Develop image interpretation skills',
        'Practice technique selection',
        'Focus on radiation safety principles'
      ],
      pharmacy: [
        'Master drug interaction checking',
        'Practice patient counseling',
        'Focus on medication therapy optimization'
      ]
    };

    return disciplineGuidance[discipline] || disciplineGuidance.medicine;
  }
}

export default new HelpGuidanceService();
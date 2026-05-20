import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import auditLogger from './AuditLoggerService.js';
import StudentProgressService from './StudentProgressService.js';
import mongoose from 'mongoose';

/**
 * Student Dashboard Service
 * Provides personalized dashboard functionality for students including
 * discipline-specific content, case recommendations, progress tracking, and achievements
 */
class StudentDashboardService {
  constructor() {
    this.defaultPageSize = 12;
    this.maxPageSize = 50;
    this.disciplineConfig = {
      medicine: {
        name: 'Medicine',
        icon: 'stethoscope',
        primaryColor: '#e74c3c',
        competencies: ['clinical_reasoning', 'diagnosis', 'treatment_planning', 'patient_communication'],
        caseTypes: ['clinical_cases', 'emergency_medicine', 'internal_medicine', 'surgery']
      },
      nursing: {
        name: 'Nursing',
        icon: 'heart',
        primaryColor: '#3498db',
        competencies: ['patient_care', 'medication_administration', 'care_planning', 'patient_safety'],
        caseTypes: ['patient_care', 'medication_management', 'emergency_nursing', 'critical_care']
      },
      laboratory: {
        name: 'Laboratory',
        icon: 'flask',
        primaryColor: '#9b59b6',
        competencies: ['specimen_handling', 'test_interpretation', 'quality_control', 'safety_protocols'],
        caseTypes: ['diagnostic_testing', 'quality_assurance', 'laboratory_safety', 'result_interpretation']
      },
      radiology: {
        name: 'Radiology',
        icon: 'x-ray',
        primaryColor: '#f39c12',
        competencies: ['image_interpretation', 'technique_selection', 'radiation_safety', 'reporting'],
        caseTypes: ['imaging_interpretation', 'technique_optimization', 'radiation_safety', 'diagnostic_reporting']
      },
      pharmacy: {
        name: 'Pharmacy',
        icon: 'pills',
        primaryColor: '#27ae60',
        competencies: ['medication_therapy', 'drug_interactions', 'patient_counseling', 'pharmaceutical_care'],
        caseTypes: ['medication_therapy', 'drug_interactions', 'patient_counseling', 'pharmaceutical_care']
      }
    };
  }

  /**
   * Get student dashboard overview
   * @param {Object} student - Student user object
   * @returns {Promise<Object>} - Dashboard overview data
   */
  async getDashboardOverview(student) {
    try {
      const discipline = student.profile?.discipline || 'medicine';
      const disciplineConfig = this.disciplineConfig[discipline];

      const [
        progressSummary,
        recommendedCases,
        recentActivity,
        achievements,
        learningPath,
        upcomingDeadlines
      ] = await Promise.all([
        this.getProgressSummary(student),
        this.getRecommendedCases(student, 6),
        this.getRecentActivity(student, 5),
        this.getAchievements(student),
        this.getLearningPath(student),
        this.getUpcomingDeadlines(student)
      ]);

      return {
        student: {
          id: student._id,
          name: student.profile?.firstName && student.profile?.lastName 
            ? `${student.profile.firstName} ${student.profile.lastName}`
            : student.username,
          discipline: discipline,
          disciplineConfig: disciplineConfig,
          yearOfStudy: student.profile?.yearOfStudy,
          institution: student.profile?.institution
        },
        progressSummary,
        recommendedCases,
        recentActivity,
        achievements,
        learningPath,
        upcomingDeadlines,
        quickActions: this.getQuickActions(student, discipline)
      };
    } catch (error) {
      console.error('Get student dashboard overview error:', error);
      throw new Error('Failed to load dashboard overview');
    }
  }  
  
  /**
   * Get student progress summary
   * @param {Object} student - Student user object
   * @returns {Promise<Object>} - Progress summary data
   */
  async getProgressSummary(student) {
    try {
      // Get progress data from ClinicianProgress model (which contains actual scores)
      const { progress, recentMetrics } = await import('../services/clinicianProgressService.js')
        .then(module => module.getClinicianProgress(student._id));
      
      if (!progress) {
        return {
          totalAttempts: 0,
          completedCases: 0,
          averageScore: 0,
          // Frontend expects these specific field names
          totalCasesCompleted: 0,
          totalCasesAttempted: 0,
          overallAverageScore: 0,
          overallProgress: 0,
          competencyScores: {},
          recentTrend: 'stable',
          nextMilestone: null,
          studyStreak: 0,
          lastActivity: null
        };
      }

      // Calculate recent trend from recent metrics
      const recentTrend = this.calculateRecentTrendFromMetrics(recentMetrics);

      // Get next milestone based on overall progress
      const nextMilestone = await this.getNextMilestone(student, progress.overallAverageScore);

      return {
        totalAttempts: progress.totalCasesCompleted, // Total attempts is same as completed for this use case
        completedCases: progress.totalCasesCompleted,
        averageScore: progress.overallAverageScore,
        // Frontend expects these specific field names
        totalCasesCompleted: progress.totalCasesCompleted,
        totalCasesAttempted: progress.totalCasesCompleted, // Using completed cases as attempted for now
        overallAverageScore: progress.overallAverageScore,
        overallProgress: Math.min(100, Math.round((progress.totalCasesCompleted / 50) * 100)), // Progress out of 50 cases target
        competencyScores: {
          beginner: progress.beginnerAverageScore,
          intermediate: progress.intermediateAverageScore,
          advanced: progress.advancedAverageScore
        },
        recentTrend,
        nextMilestone,
        studyStreak: 0, // Would need to implement streak calculation
        lastActivity: progress.lastUpdatedAt,
        // Additional useful data
        progressionLevel: progress.currentProgressionLevel,
        beginnerCases: progress.beginnerCasesCompleted,
        intermediateCases: progress.intermediateCasesCompleted,
        advancedCases: progress.advancedCasesCompleted
      };
    } catch (error) {
      console.error('Get progress summary error:', error);
      // Return default values on error
      return {
        totalAttempts: 0,
        completedCases: 0,
        averageScore: 0,
        // Frontend expects these specific field names
        totalCasesCompleted: 0,
        totalCasesAttempted: 0,
        overallAverageScore: 0,
        overallProgress: 0,
        competencyScores: {},
        recentTrend: 'stable',
        nextMilestone: null,
        studyStreak: 0,
        lastActivity: null
      };
    }
  }

  /**
   * Get personalized case recommendations
   * @param {Object} student - Student user object
   * @param {number} limit - Number of recommendations to return
   * @returns {Promise<Array>} - Recommended cases
   */
  async getRecommendedCases(student, limit = 6) {
    try {
      const discipline = student.profile?.discipline || 'medicine';
      const competencyScores = await this.getStudentCompetencyScores(student);
      
      // Get cases suitable for student's discipline and level
      const query = {
        status: 'published',
        'case_metadata.specialty': discipline
      };

      // Get student's completed cases to avoid recommending them again
      const completedCaseIds = await this.getCompletedCaseIds(student);
      if (completedCaseIds.length > 0) {
        query._id = { $nin: completedCaseIds };
      }

      const availableCases = await Case.find(query)
        .select('case_metadata description patient_persona clinical_dossier createdAt')
        .lean();

      // Score and rank cases based on student's needs
      const scoredCases = availableCases.map(caseDoc => {
        const relevanceScore = this.calculateCaseRelevance(caseDoc, student, competencyScores);
        return {
          ...caseDoc,
          relevanceScore,
          recommendationReason: this.generateRecommendationReason(caseDoc, student, competencyScores)
        };
      });

      // Sort by relevance and return top recommendations
      return scoredCases
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit)
        .map(caseDoc => ({
          id: caseDoc._id,
          title: caseDoc.case_metadata?.title || 'Untitled Case',
          description: caseDoc.description,
          difficulty: caseDoc.case_metadata?.difficulty || 'intermediate',
          specialty: caseDoc.case_metadata?.specialty,
          estimatedDuration: caseDoc.case_metadata?.estimated_duration || 30,
          relevanceScore: caseDoc.relevanceScore,
          recommendationReason: caseDoc.recommendationReason,
          patientAge: caseDoc.patient_persona?.age,
          patientGender: caseDoc.patient_persona?.gender,
          chiefComplaint: caseDoc.patient_persona?.chief_complaint || caseDoc.clinical_dossier?.chief_complaint
        }));
    } catch (error) {
      console.error('Get recommended cases error:', error);
      throw error;
    }
  }

  /**
   * Get recent activity for student
   * @param {Object} student - Student user object
   * @param {number} limit - Number of activities to return
   * @returns {Promise<Array>} - Recent activities
   */
  async getRecentActivity(student, limit = 5) {
    try {
      const recentAttempts = await StudentProgressService.getCaseAttemptHistory(student._id, limit);
      
      const activities = await Promise.all(
        recentAttempts.map(async (attempt) => {
          const caseDoc = await Case.findById(attempt.caseId)
            .select('case_metadata')
            .lean();

          return {
            id: attempt._id,
            type: 'case_attempt',
            title: caseDoc?.case_metadata?.title || attempt.caseTitle || 'Unknown Case',
            status: attempt.status,
            score: attempt.score,
            startTime: attempt.startTime,
            endTime: attempt.endTime,
            duration: attempt.duration,
            caseId: attempt.caseId
          };
        })
      );

      return activities;
    } catch (error) {
      console.error('Get recent activity error:', error);
      throw error;
    }
  }

  /**
   * Get student achievements
   * @param {Object} student - Student user object
   * @returns {Promise<Object>} - Achievement data
   */
  async getAchievements(student) {
    try {
      // Get progress data from ClinicianProgress for accurate counts
      const { progress } = await import('../services/clinicianProgressService.js')
        .then(module => module.getClinicianProgress(student._id));
      
      const completedCases = progress?.totalCasesCompleted || 0;
      const averageScore = progress?.overallAverageScore || 0;

      // Try to get achievements from StudentProgressService (if any exist)
      let achievements = [];
      let milestones = [];
      try {
        const studentAchievements = await StudentProgressService.getAchievementsAndMilestones(student._id);
        achievements = studentAchievements.achievements || [];
        milestones = studentAchievements.milestones || [];
      } catch (error) {
        console.log('No student achievements found, using progress-based milestones only');
      }

      // Format achievements for dashboard
      const formattedAchievements = {
        badges: achievements.map(ach => ({
          id: ach.achievementId?.toString() || ach._id?.toString(),
          name: ach.name,
          icon: this.getAchievementIcon(ach.type),
          earnedAt: ach.earnedDate,
          tier: ach.tier
        })),
        milestones: milestones.map(ms => ({
          id: ms.milestoneId?.toString() || ms._id?.toString(),
          name: ms.name,
          description: ms.description,
          achievedDate: ms.achievedDate,
          rewardPoints: ms.rewardPoints
        })),
        streaks: {
          current: 0, // Would need to implement streak calculation properly
          longest: 0
        },
        totalPoints: achievements.reduce((sum, ach) => sum + (ach.rewardPoints || 0), 0) +
                   milestones.reduce((sum, ms) => sum + (ms.rewardPoints || 0), 0)
      };

      // Add system-generated milestones based on actual progress
      const systemMilestones = [
        { id: 'cases_5', name: '5 Cases Completed', target: 5, current: completedCases, completed: completedCases >= 5 },
        { id: 'cases_10', name: '10 Cases Completed', target: 10, current: completedCases, completed: completedCases >= 10 },
        { id: 'cases_25', name: '25 Cases Completed', target: 25, current: completedCases, completed: completedCases >= 25 },
        { id: 'cases_50', name: '50 Cases Completed', target: 50, current: completedCases, completed: completedCases >= 50 },
        { id: 'score_70', name: '70% Average Score', target: 70, current: Math.round(averageScore), completed: averageScore >= 70 },
        { id: 'score_85', name: '85% Average Score', target: 85, current: Math.round(averageScore), completed: averageScore >= 85 },
        { id: 'score_90', name: '90% Average Score', target: 90, current: Math.round(averageScore), completed: averageScore >= 90 }
      ];

      formattedAchievements.milestones.push(...systemMilestones);

      return formattedAchievements;
    } catch (error) {
      console.error('Get achievements error:', error);
      throw error;
    }
  }

  /**
   * Get personalized learning path
   * @param {Object} student - Student user object
   * @returns {Promise<Object>} - Learning path data
   */
  async getLearningPath(student) {
    try {
      const discipline = student.profile?.discipline || 'medicine';
      const competencyScores = await this.getStudentCompetencyScores(student);
      const disciplineConfig = this.disciplineConfig[discipline];

      // Identify areas needing improvement
      const improvementAreas = Object.entries(competencyScores)
        .filter(([_, score]) => score < 75)
        .sort(([_, a], [__, b]) => a - b)
        .slice(0, 3);

      // Get recommended learning path
      const learningPath = {
        currentLevel: this.calculateStudentLevel(student, competencyScores),
        nextLevel: null,
        recommendedCases: [],
        focusAreas: improvementAreas.map(([competency, score]) => ({
          competency,
          currentScore: score,
          targetScore: 85,
          priority: score < 60 ? 'high' : score < 75 ? 'medium' : 'low'
        })),
        estimatedTimeToNext: null
      };

      // Calculate next level and time estimate
      const currentLevel = learningPath.currentLevel;
      if (currentLevel < 5) {
        learningPath.nextLevel = currentLevel + 1;
        learningPath.estimatedTimeToNext = this.estimateTimeToNextLevel(student, competencyScores);
      }

      return learningPath;
    } catch (error) {
      console.error('Get learning path error:', error);
      throw error;
    }
  }

  /**
   * Get upcoming deadlines
   * @param {Object} student - Student user object
   * @returns {Promise<Array>} - Upcoming deadlines
   */
  async getUpcomingDeadlines(student) {
    try {
      // This would integrate with assignment/deadline system
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error('Get upcoming deadlines error:', error);
      throw error;
    }
  }

  /**
   * Get available cases for student with filtering
   * @param {Object} student - Student user object
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Paginated case list
   */
  async getAvailableCases(student, filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = this.defaultPageSize,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = ''
      } = options;

      const discipline = student.profile?.discipline || 'medicine';

      // Build query
      const query = {
        status: 'published',
        'case_metadata.specialty': discipline
      };

      // Apply filters
      if (filters.difficulty) {
        query['case_metadata.difficulty'] = Array.isArray(filters.difficulty) 
          ? { $in: filters.difficulty } 
          : filters.difficulty;
      }

      if (filters.caseType) {
        query['case_metadata.case_type'] = Array.isArray(filters.caseType)
          ? { $in: filters.caseType }
          : filters.caseType;
      }

      // Add search functionality
      if (search) {
        query.$or = [
          { 'case_metadata.title': { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'patient_persona.chief_complaint': { $regex: search, $options: 'i' } }
        ];
      }

      // Pagination
      const pageSize = Math.min(parseInt(limit), this.maxPageSize);
      const skip = (parseInt(page) - 1) * pageSize;

      // Sorting
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [cases, total] = await Promise.all([
        Case.find(query)
          .select('case_metadata description patient_persona clinical_dossier createdAt')
          .sort(sort)
          .skip(skip)
          .limit(pageSize)
          .lean(),
        Case.countDocuments(query)
      ]);

      // Get student's attempt history for these cases
      const caseIds = cases.map(c => c._id);
      const attempts = await mongoose.connection.db.collection('case_attempts').find({
        user_id: student._id,
        case_id: { $in: caseIds }
      }).toArray();

      const attemptMap = attempts.reduce((map, attempt) => {
        const caseId = attempt.case_id.toString();
        if (!map[caseId] || attempt.start_time > map[caseId].start_time) {
          map[caseId] = attempt;
        }
        return map;
      }, {});

      // Enhance cases with student-specific data
      const enhancedCases = cases.map(caseDoc => {
        const attempt = attemptMap[caseDoc._id.toString()];
        return {
          id: caseDoc._id,
          title: caseDoc.case_metadata?.title || 'Untitled Case',
          description: caseDoc.description,
          difficulty: caseDoc.case_metadata?.difficulty || 'intermediate',
          specialty: caseDoc.case_metadata?.specialty,
          estimatedDuration: caseDoc.case_metadata?.estimated_duration || 30,
          patientAge: caseDoc.patient_persona?.age,
          patientGender: caseDoc.patient_persona?.gender,
          chiefComplaint: caseDoc.patient_persona?.chief_complaint || caseDoc.clinical_dossier?.chief_complaint,
          createdAt: caseDoc.createdAt,
          studentProgress: attempt ? {
            status: attempt.status,
            score: attempt.score?.overall,
            attempts: attempts.filter(a => a.case_id.toString() === caseDoc._id.toString()).length,
            lastAttempt: attempt.start_time
          } : null
        };
      });

      return {
        cases: enhancedCases,
        pagination: {
          page: parseInt(page),
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: skip + pageSize < total,
          hasPrev: page > 1
        },
        filters: filters,
        sort: { sortBy, sortOrder }
      };
    } catch (error) {
      console.error('Get available cases error:', error);
      throw error;
    }
  } 
 // Helper methods

  /**
   * Calculate competency scores for student
   */
  calculateCompetencyScores(caseAttempts, discipline) {
    const disciplineConfig = this.disciplineConfig[discipline] || this.disciplineConfig.medicine;
    const competencies = {};

    // Initialize competencies
    disciplineConfig.competencies.forEach(competency => {
      competencies[competency] = [];
    });

    // Collect scores for each competency
    caseAttempts.forEach(attempt => {
      if (attempt.detailed_metrics) {
        Object.keys(attempt.detailed_metrics).forEach(competency => {
          if (competencies[competency]) {
            competencies[competency].push(attempt.detailed_metrics[competency]);
          }
        });
      }
    });

    // Calculate averages
    Object.keys(competencies).forEach(competency => {
      const scores = competencies[competency];
      competencies[competency] = scores.length > 0 
        ? parseFloat((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
        : 0;
    });

    return competencies;
  }

  /**
   * Calculate overall progress percentage
   */
  calculateOverallProgress(student, caseAttempts, competencyScores) {
    const completedCases = new Set(caseAttempts.map(attempt => attempt.case_id.toString())).size;
    const averageScore = caseAttempts.length > 0 
      ? caseAttempts.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0) / caseAttempts.length
      : 0;
    
    const averageCompetency = Object.values(competencyScores).length > 0
      ? Object.values(competencyScores).reduce((sum, score) => sum + score, 0) / Object.values(competencyScores).length
      : 0;

    // Weight different factors
    const caseProgress = Math.min(completedCases * 4, 40); // Up to 40% for cases (10 cases = 40%)
    const scoreProgress = (averageScore / 100) * 30; // Up to 30% for average score
    const competencyProgress = (averageCompetency / 100) * 30; // Up to 30% for competencies

    return Math.min(caseProgress + scoreProgress + competencyProgress, 100);
  }

  /**
   * Calculate recent trend
   */
  calculateRecentTrend(caseAttempts) {
    if (caseAttempts.length < 2) return 'stable';

    const sortedAttempts = caseAttempts.sort((a, b) =>
      new Date(a.startTime || a.createdAt) - new Date(b.startTime || b.createdAt));

    const recentCount = Math.min(5, Math.floor(sortedAttempts.length / 2));
    const recent = sortedAttempts.slice(-recentCount);
    const previous = sortedAttempts.slice(-recentCount * 2, -recentCount);

    if (previous.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / recent.length;
    const previousAvg = previous.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / previous.length;

    const difference = recentAvg - previousAvg;
    
    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  /**
   * Calculate recent trend from performance metrics
   * @param {Array} recentMetrics - Recent performance metrics
   * @returns {string} - Trend direction ('improving', 'declining', 'stable')
   */
  calculateRecentTrendFromMetrics(recentMetrics) {
    if (!recentMetrics || recentMetrics.length < 3) return 'stable';
    
    const validMetrics = recentMetrics.filter(m => m.metrics?.overall_score != null);
    if (validMetrics.length < 3) return 'stable';
    
    const scores = validMetrics.map(m => m.metrics.overall_score);
    const recent = scores.slice(0, Math.ceil(scores.length / 2));
    const older = scores.slice(Math.ceil(scores.length / 2));
    
    const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
    const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;
    
    if (recentAvg > olderAvg + 5) return 'improving';
    if (recentAvg < olderAvg - 5) return 'declining';
    return 'stable';
  }

  /**
   * Get next milestone for student
   */
  async getNextMilestone(student, overallProgress) {
    const milestones = [
      { progress: 20, name: 'Getting Started', description: 'Complete your first few cases' },
      { progress: 40, name: 'Building Skills', description: 'Develop core competencies' },
      { progress: 60, name: 'Gaining Confidence', description: 'Master intermediate concepts' },
      { progress: 80, name: 'Advanced Learner', description: 'Tackle complex scenarios' },
      { progress: 100, name: 'Expert Level', description: 'Achieve mastery in your discipline' }
    ];

    return milestones.find(milestone => milestone.progress > overallProgress) || null;
  }

  /**
   * Calculate study streak
   */
  async calculateStudyStreak(student) {
    try {
      const attempts = await mongoose.connection.db.collection('case_attempts').find({
        user_id: student._id
      }).sort({ start_time: -1 }).toArray();

      if (attempts.length === 0) return 0;

      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (const attempt of attempts) {
        const attemptDate = new Date(attempt.start_time);
        attemptDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((currentDate - attemptDate) / (1000 * 60 * 60 * 24));

        if (daysDiff === streak) {
          streak++;
        } else if (daysDiff === streak + 1) {
          // Allow for one day gap
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      console.error('Calculate study streak error:', error);
      return 0;
    }
  }

  /**
   * Get student's competency scores
   */
  async getStudentCompetencyScores(student) {
    try {
      const progressSummary = await StudentProgressService.getProgressSummary(student._id);
      return this.formatCompetencyScores(progressSummary.competencies);
    } catch (error) {
      console.error('Get student competency scores error:', error);
      return {};
    }
  }

  /**
   * Get completed case IDs for student
   */
  async getCompletedCaseIds(student) {
    const attempts = await mongoose.connection.db.collection('case_attempts').find({
      user_id: student._id,
      status: 'completed'
    }).toArray();

    return [...new Set(attempts.map(attempt => attempt.case_id))];
  }

  /**
   * Calculate case relevance score for recommendations
   */
  calculateCaseRelevance(caseDoc, student, competencyScores) {
    let score = 50; // Base score

    const difficulty = caseDoc.case_metadata?.difficulty || 'intermediate';
    const studentLevel = this.calculateStudentLevel(student, competencyScores);

    // Difficulty matching
    if (difficulty === 'beginner' && studentLevel <= 2) score += 20;
    else if (difficulty === 'intermediate' && studentLevel >= 2 && studentLevel <= 4) score += 20;
    else if (difficulty === 'advanced' && studentLevel >= 4) score += 20;
    else score -= 10;

    // Competency alignment
    const avgCompetency = Object.values(competencyScores).length > 0
      ? Object.values(competencyScores).reduce((sum, s) => sum + s, 0) / Object.values(competencyScores).length
      : 50;

    if (difficulty === 'beginner' && avgCompetency < 60) score += 15;
    else if (difficulty === 'intermediate' && avgCompetency >= 60 && avgCompetency < 80) score += 15;
    else if (difficulty === 'advanced' && avgCompetency >= 80) score += 15;

    // Recency bonus for newer cases
    const daysSinceCreated = (new Date() - new Date(caseDoc.createdAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 30) score += 10;
    else if (daysSinceCreated < 90) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendation reason
   */
  generateRecommendationReason(caseDoc, student, competencyScores) {
    const difficulty = caseDoc.case_metadata?.difficulty || 'intermediate';
    const studentLevel = this.calculateStudentLevel(student, competencyScores);
    const avgCompetency = Object.values(competencyScores).length > 0
      ? Object.values(competencyScores).reduce((sum, s) => sum + s, 0) / Object.values(competencyScores).length
      : 50;

    if (difficulty === 'beginner' && studentLevel <= 2) {
      return 'Perfect for building foundational skills';
    } else if (difficulty === 'intermediate' && avgCompetency < 75) {
      return 'Great for developing core competencies';
    } else if (difficulty === 'advanced' && avgCompetency >= 80) {
      return 'Challenge yourself with advanced scenarios';
    } else if (avgCompetency < 60) {
      return 'Recommended to strengthen weak areas';
    } else {
      return 'Matches your current learning level';
    }
  }

  /**
   * Calculate student level (1-5)
   */
  calculateStudentLevel(student, competencyScores) {
    const avgCompetency = Object.values(competencyScores).length > 0
      ? Object.values(competencyScores).reduce((sum, s) => sum + s, 0) / Object.values(competencyScores).length
      : 0;

    if (avgCompetency < 40) return 1;
    if (avgCompetency < 60) return 2;
    if (avgCompetency < 75) return 3;
    if (avgCompetency < 90) return 4;
    return 5;
  }

  /**
   * Estimate time to next level
   */
  estimateTimeToNextLevel(student, competencyScores) {
    const currentLevel = this.calculateStudentLevel(student, competencyScores);
    const avgCompetency = Object.values(competencyScores).length > 0
      ? Object.values(competencyScores).reduce((sum, s) => sum + s, 0) / Object.values(competencyScores).length
      : 0;

    const levelThresholds = [0, 40, 60, 75, 90, 100];
    const nextThreshold = levelThresholds[currentLevel + 1] || 100;
    const pointsNeeded = nextThreshold - avgCompetency;

    // Estimate based on typical progress rate (2-3 points per case)
    const casesNeeded = Math.ceil(pointsNeeded / 2.5);
    const hoursNeeded = casesNeeded * 0.75; // Assuming 45 minutes per case

    return {
      casesNeeded,
      hoursNeeded: Math.round(hoursNeeded),
      weeksNeeded: Math.ceil(hoursNeeded / 5) // Assuming 5 hours study per week
    };
  }

  /**
   * Get quick actions for student dashboard
   */
  getQuickActions(student, discipline) {
    const disciplineConfig = this.disciplineConfig[discipline];
    
    return [
      {
        id: 'start_case',
        label: 'Start New Case',
        icon: 'play',
        color: disciplineConfig.primaryColor,
        url: '/student/cases'
      },
      {
        id: 'continue_learning',
        label: 'Continue Learning',
        icon: 'book-open',
        color: '#3498db',
        url: '/student/learning-path'
      },
      {
        id: 'view_progress',
        label: 'View Progress',
        icon: 'chart-line',
        color: '#27ae60',
        url: '/student/progress'
      },
      {
        id: 'get_help',
        label: 'Get Help',
        icon: 'question-circle',
        color: '#f39c12',
        url: '/student/help'
      }
    ];
  }

  /**
   * Format competency scores for dashboard display
   */
  formatCompetencyScores(competencies) {
    const scores = {};
    competencies.forEach(comp => {
      scores[comp.competencyName || comp.competencyId?.toString()] = comp.score;
    });
    return scores;
  }

  /**
   * Get appropriate icon for achievement type
   */
  getAchievementIcon(achievementType) {
    const iconMap = {
      'skill': 'star',
      'completion': 'check-circle',
      'performance': 'trophy',
      'participation': 'users'
    };
    return iconMap[achievementType] || 'award';
  }
}

export default new StudentDashboardService();
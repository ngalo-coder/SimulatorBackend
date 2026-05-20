import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import auditLogger from './AuditLoggerService.js';
import mongoose from 'mongoose';

/**
 * Educator Dashboard Service
 * Provides comprehensive dashboard functionality for educators including student management,
 * case analytics, performance tracking, and class management
 */
class EducatorDashboardService {
  constructor() {
    this.defaultPageSize = 20;
    this.maxPageSize = 100;
  }

  /**
   * Get educator dashboard overview
   * @param {Object} educator - Educator user object
   * @returns {Promise<Object>} - Dashboard overview data
   */
  async getDashboardOverview(educator) {
    try {
      const [
        studentStats,
        caseStats,
        recentActivity,
        performanceMetrics,
        upcomingDeadlines
      ] = await Promise.all([
        this.getStudentStatistics(educator),
        this.getCaseStatistics(educator),
        this.getRecentActivity(educator),
        this.getPerformanceMetrics(educator),
        this.getUpcomingDeadlines(educator)
      ]);

      return {
        overview: {
          totalStudents: studentStats.totalStudents,
          activeStudents: studentStats.activeStudents,
          totalCases: caseStats.totalCases,
          publishedCases: caseStats.publishedCases,
          averagePerformance: performanceMetrics.averageScore,
          completionRate: performanceMetrics.completionRate
        },
        studentStats,
        caseStats,
        recentActivity,
        performanceMetrics,
        upcomingDeadlines,
        quickActions: this.getQuickActions(educator)
      };
    } catch (error) {
      console.error('Get dashboard overview error:', error);
      throw new Error('Failed to load dashboard overview');
    }
  }

  /**
   * Get student statistics for educator
   * @param {Object} educator - Educator user object
   * @returns {Promise<Object>} - Student statistics
   */
  async getStudentStatistics(educator) {
    try {
      // Get students assigned to this educator
      const assignedStudents = await User.find({
        primaryRole: 'student',
        'profile.assignedEducators': educator._id,
        isActive: true
      }).lean();

      const studentIds = assignedStudents.map(student => student._id);

      // Get activity statistics
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        activeStudentsLast30Days,
        activeStudentsLast7Days,
        newStudentsThisMonth,
        studentsNeedingAttention
      ] = await Promise.all([
        User.countDocuments({
          _id: { $in: studentIds },
          lastLogin: { $gte: thirtyDaysAgo }
        }),
        User.countDocuments({
          _id: { $in: studentIds },
          lastLogin: { $gte: sevenDaysAgo }
        }),
        User.countDocuments({
          _id: { $in: studentIds },
          createdAt: { $gte: thirtyDaysAgo }
        }),
        this.getStudentsNeedingAttention(studentIds)
      ]);

      // Get discipline breakdown
      const disciplineBreakdown = await User.aggregate([
        { $match: { _id: { $in: studentIds } } },
        { $group: { _id: '$profile.discipline', count: { $sum: 1 } } }
      ]);

      return {
        totalStudents: assignedStudents.length,
        activeStudents: activeStudentsLast30Days,
        activeStudentsLast7Days,
        newStudentsThisMonth,
        studentsNeedingAttention: studentsNeedingAttention.length,
        disciplineBreakdown: disciplineBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        engagementRate: assignedStudents.length > 0 
          ? (activeStudentsLast7Days / assignedStudents.length * 100).toFixed(1)
          : 0
      };
    } catch (error) {
      console.error('Get student statistics error:', error);
      throw error;
    }
  }

  /**
   * Get case statistics for educator
   * @param {Object} educator - Educator user object
   * @returns {Promise<Object>} - Case statistics
   */
  async getCaseStatistics(educator) {
    try {
      const [
        totalCases,
        draftCases,
        publishedCases,
        pendingReviewCases,
        caseUsageStats,
        topPerformingCases
      ] = await Promise.all([
        Case.countDocuments({ createdBy: educator._id }),
        Case.countDocuments({ createdBy: educator._id, status: 'draft' }),
        Case.countDocuments({ createdBy: educator._id, status: 'published' }),
        Case.countDocuments({ createdBy: educator._id, status: 'pending_review' }),
        this.getCaseUsageStatistics(educator._id),
        this.getTopPerformingCases(educator._id, 5)
      ]);

      return {
        totalCases,
        draftCases,
        publishedCases,
        pendingReviewCases,
        rejectedCases: totalCases - (draftCases + publishedCases + pendingReviewCases),
        usageStats: caseUsageStats,
        topPerformingCases,
        publicationRate: totalCases > 0 ? (publishedCases / totalCases * 100).toFixed(1) : 0
      };
    } catch (error) {
      console.error('Get case statistics error:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics for educator's students
   * @param {Object} educator - Educator user object
   * @returns {Promise<Object>} - Performance metrics
   */
  async getPerformanceMetrics(educator) {
    try {
      // Get assigned students
      const assignedStudents = await User.find({
        primaryRole: 'student',
        'profile.assignedEducators': educator._id,
        isActive: true
      }).select('_id').lean();

      const studentIds = assignedStudents.map(student => student._id);

      if (studentIds.length === 0) {
        return {
          averageScore: 0,
          completionRate: 0,
          improvementRate: 0,
          competencyProgress: {},
          performanceTrends: []
        };
      }

      // Get case attempts for assigned students
      const caseAttempts = await mongoose.connection.db.collection('case_attempts').find({
        user_id: { $in: studentIds },
        status: 'completed'
      }).toArray();

      if (caseAttempts.length === 0) {
        return {
          averageScore: 0,
          completionRate: 0,
          improvementRate: 0,
          competencyProgress: {},
          performanceTrends: []
        };
      }

      // Calculate metrics
      const totalScore = caseAttempts.reduce((sum, attempt) => 
        sum + (attempt.score?.overall || 0), 0);
      const averageScore = (totalScore / caseAttempts.length).toFixed(1);

      // Calculate completion rate (students who completed at least one case)
      const studentsWithAttempts = new Set(caseAttempts.map(attempt => attempt.user_id.toString()));
      const completionRate = (studentsWithAttempts.size / studentIds.length * 100).toFixed(1);

      // Calculate improvement rate (comparing first and latest attempts)
      const improvementRate = await this.calculateImprovementRate(studentIds);

      // Get competency progress
      const competencyProgress = await this.getCompetencyProgress(studentIds);

      // Get performance trends (last 6 months)
      const performanceTrends = await this.getPerformanceTrends(studentIds, 6);

      return {
        averageScore: parseFloat(averageScore),
        completionRate: parseFloat(completionRate),
        improvementRate,
        competencyProgress,
        performanceTrends,
        totalAttempts: caseAttempts.length,
        uniqueStudentsActive: studentsWithAttempts.size
      };
    } catch (error) {
      console.error('Get performance metrics error:', error);
      throw error;
    }
  }

  /**
   * Get assigned students with detailed information
   * @param {Object} educator - Educator user object
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Paginated student list with details
   */
  async getAssignedStudents(educator, options = {}) {
    try {
      const {
        page = 1,
        limit = this.defaultPageSize,
        sortBy = 'profile.lastName',
        sortOrder = 'asc',
        search = '',
        discipline = '',
        status = 'all'
      } = options;

      // Build query
      const query = {
        primaryRole: 'student',
        'profile.assignedEducators': educator._id
      };

      // Add search functionality
      if (search) {
        query.$or = [
          { 'profile.firstName': { $regex: search, $options: 'i' } },
          { 'profile.lastName': { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      // Add discipline filter
      if (discipline) {
        query['profile.discipline'] = discipline;
      }

      // Add status filter
      if (status === 'active') {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        query.lastLogin = { $gte: sevenDaysAgo };
      } else if (status === 'inactive') {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        query.$or = [
          { lastLogin: { $lt: sevenDaysAgo } },
          { lastLogin: { $exists: false } }
        ];
      }

      // Pagination
      const pageSize = Math.min(parseInt(limit), this.maxPageSize);
      const skip = (parseInt(page) - 1) * pageSize;

      // Sorting
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [students, total] = await Promise.all([
        User.find(query)
          .select('username email profile lastLogin createdAt isActive')
          .sort(sort)
          .skip(skip)
          .limit(pageSize)
          .lean(),
        User.countDocuments(query)
      ]);

      // Enhance student data with progress information
      const enhancedStudents = await Promise.all(
        students.map(async (student) => {
          const progress = await this.getStudentProgress(student._id);
          return {
            ...student,
            progress
          };
        })
      );

      return {
        students: enhancedStudents,
        pagination: {
          page: parseInt(page),
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: skip + pageSize < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Get assigned students error:', error);
      throw error;
    }
  }

  /**
   * Get detailed student progress
   * @param {string} studentId - Student ID
   * @returns {Promise<Object>} - Student progress details
   */
  async getStudentProgress(studentId) {
    try {
      // Get case attempts
      const caseAttempts = await mongoose.connection.db.collection('case_attempts').find({
        user_id: new mongoose.Types.ObjectId(studentId),
        status: 'completed'
      }).toArray();

      if (caseAttempts.length === 0) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          completedCases: 0,
          lastActivity: null,
          competencyScores: {},
          recentTrend: 'stable'
        };
      }

      // Calculate metrics
      const totalScore = caseAttempts.reduce((sum, attempt) => 
        sum + (attempt.score?.overall || 0), 0);
      const averageScore = (totalScore / caseAttempts.length).toFixed(1);

      // Get unique completed cases
      const completedCases = new Set(caseAttempts.map(attempt => attempt.case_id.toString())).size;

      // Get last activity
      const lastActivity = new Date(Math.max(...caseAttempts.map(attempt => 
        new Date(attempt.end_time || attempt.start_time).getTime())));

      // Calculate competency scores
      const competencyScores = this.calculateCompetencyScores(caseAttempts);

      // Calculate recent trend (last 5 attempts vs previous 5)
      const recentTrend = this.calculateRecentTrend(caseAttempts);

      return {
        totalAttempts: caseAttempts.length,
        averageScore: parseFloat(averageScore),
        completedCases,
        lastActivity,
        competencyScores,
        recentTrend
      };
    } catch (error) {
      console.error('Get student progress error:', error);
      throw error;
    }
  }

  /**
   * Get educator's case management interface data
   * @param {Object} educator - Educator user object
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Case management data
   */
  async getCaseManagementData(educator, options = {}) {
    try {
      const {
        page = 1,
        limit = this.defaultPageSize,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
        status = 'all',
        discipline = ''
      } = options;

      // Build query
      const query = { createdBy: educator._id };

      if (status !== 'all') {
        query.status = status;
      }

      if (discipline) {
        query['case_metadata.specialty'] = discipline;
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
          .populate('createdBy', 'username profile.firstName profile.lastName')
          .populate('lastModifiedBy', 'username profile.firstName profile.lastName')
          .sort(sort)
          .skip(skip)
          .limit(pageSize)
          .lean(),
        Case.countDocuments(query)
      ]);

      // Enhance cases with usage statistics
      const enhancedCases = await Promise.all(
        cases.map(async (caseDoc) => {
          const usageStats = await this.getCaseUsageStats(caseDoc._id);
          return {
            ...caseDoc,
            usageStats
          };
        })
      );

      return {
        cases: enhancedCases,
        pagination: {
          page: parseInt(page),
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: skip + pageSize < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Get case management data error:', error);
      throw error;
    }
  }

  /**
   * Get analytics for a specific case
   * @param {string} caseId - Case ID
   * @param {Object} educator - Educator user object
   * @returns {Promise<Object>} - Case analytics
   */
  async getCaseAnalytics(caseId, educator) {
    try {
      // Verify educator owns the case
      const caseDoc = await Case.findOne({ _id: caseId, createdBy: educator._id });
      if (!caseDoc) {
        throw new Error('Case not found or access denied');
      }

      // Get case attempts
      const caseAttempts = await mongoose.connection.db.collection('case_attempts').find({
        case_id: new mongoose.Types.ObjectId(caseId),
        status: 'completed'
      }).toArray();

      if (caseAttempts.length === 0) {
        return {
          totalAttempts: 0,
          uniqueStudents: 0,
          averageScore: 0,
          completionRate: 0,
          averageTimeSpent: 0,
          difficultyRating: 0,
          performanceDistribution: {},
          commonMistakes: [],
          improvementSuggestions: []
        };
      }

      // Calculate analytics
      const uniqueStudents = new Set(caseAttempts.map(attempt => attempt.user_id.toString())).size;
      const totalScore = caseAttempts.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0);
      const averageScore = (totalScore / caseAttempts.length).toFixed(1);
      const averageTimeSpent = Math.round(
        caseAttempts.reduce((sum, attempt) => sum + (attempt.time_spent || 0), 0) / caseAttempts.length
      );

      // Performance distribution
      const performanceDistribution = this.calculatePerformanceDistribution(caseAttempts);

      // Common mistakes analysis
      const commonMistakes = await this.analyzeCommonMistakes(caseAttempts);

      // Improvement suggestions
      const improvementSuggestions = await this.generateImprovementSuggestions(caseAttempts, caseDoc);

      return {
        totalAttempts: caseAttempts.length,
        uniqueStudents,
        averageScore: parseFloat(averageScore),
        completionRate: 100, // All attempts in this query are completed
        averageTimeSpent,
        difficultyRating: this.calculateDifficultyRating(caseAttempts),
        performanceDistribution,
        commonMistakes,
        improvementSuggestions,
        lastAttempt: new Date(Math.max(...caseAttempts.map(attempt => 
          new Date(attempt.end_time || attempt.start_time).getTime())))
      };
    } catch (error) {
      console.error('Get case analytics error:', error);
      throw error;
    }
  }

  /**
   * Create class or group for student management
   * @param {Object} classData - Class data
   * @param {Object} educator - Educator user object
   * @returns {Promise<Object>} - Created class
   */
  async createClass(classData, educator) {
    try {
      const { name, description, discipline, studentIds = [] } = classData;

      // Validate students exist and are students
      if (studentIds.length > 0) {
        const students = await User.find({
          _id: { $in: studentIds },
          primaryRole: 'student'
        });

        if (students.length !== studentIds.length) {
          throw new Error('Some student IDs are invalid');
        }
      }

      // Create class document (you might want to create a separate Class model)
      const classDoc = {
        _id: new mongoose.Types.ObjectId(),
        name,
        description,
        discipline,
        educator: educator._id,
        students: studentIds,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // Save to classes collection
      await mongoose.connection.db.collection('classes').insertOne(classDoc);

      // Update students to include this educator
      if (studentIds.length > 0) {
        await User.updateMany(
          { _id: { $in: studentIds } },
          { $addToSet: { 'profile.assignedEducators': educator._id } }
        );
      }

      // Log class creation
      await auditLogger.logAuthEvent({
        event: 'CLASS_CREATED',
        userId: educator._id,
        username: educator.username,
        metadata: {
          classId: classDoc._id,
          className: name,
          studentCount: studentIds.length
        }
      });

      return classDoc;
    } catch (error) {
      console.error('Create class error:', error);
      throw error;
    }
  }

  /**
   * Get educator's classes
   * @param {Object} educator - Educator user object
   * @returns {Promise<Array>} - List of classes
   */
  async getEducatorClasses(educator) {
    try {
      const classes = await mongoose.connection.db.collection('classes').find({
        educator: educator._id,
        isActive: true
      }).toArray();

      // Enhance with student count and recent activity
      const enhancedClasses = await Promise.all(
        classes.map(async (classDoc) => {
          const studentCount = classDoc.students.length;
          const recentActivity = await this.getClassRecentActivity(classDoc._id);
          
          return {
            ...classDoc,
            studentCount,
            recentActivity
          };
        })
      );

      return enhancedClasses;
    } catch (error) {
      console.error('Get educator classes error:', error);
      throw error;
    }
  }

  // Helper methods

  async getStudentsNeedingAttention(studentIds) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return await User.find({
      _id: { $in: studentIds },
      $or: [
        { lastLogin: { $lt: sevenDaysAgo } },
        { lastLogin: { $exists: false } }
      ]
    }).select('_id username profile.firstName profile.lastName').lean();
  }

  async getCaseUsageStatistics(educatorId) {
    const cases = await Case.find({ createdBy: educatorId, status: 'published' }).select('_id').lean();
    const caseIds = cases.map(c => c._id);

    if (caseIds.length === 0) return { totalUsage: 0, averageUsage: 0 };

    const usageStats = await mongoose.connection.db.collection('case_attempts').aggregate([
      { $match: { case_id: { $in: caseIds } } },
      { $group: { _id: '$case_id', count: { $sum: 1 } } }
    ]).toArray();

    const totalUsage = usageStats.reduce((sum, stat) => sum + stat.count, 0);
    const averageUsage = caseIds.length > 0 ? (totalUsage / caseIds.length).toFixed(1) : 0;

    return { totalUsage, averageUsage: parseFloat(averageUsage) };
  }

  async getTopPerformingCases(educatorId, limit = 5) {
    const cases = await Case.find({ createdBy: educatorId, status: 'published' }).lean();
    
    const casePerformance = await Promise.all(
      cases.map(async (caseDoc) => {
        const attempts = await mongoose.connection.db.collection('case_attempts').find({
          case_id: caseDoc._id,
          status: 'completed'
        }).toArray();

        if (attempts.length === 0) {
          return { ...caseDoc, averageScore: 0, attemptCount: 0 };
        }

        const totalScore = attempts.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0);
        const averageScore = totalScore / attempts.length;

        return {
          ...caseDoc,
          averageScore: parseFloat(averageScore.toFixed(1)),
          attemptCount: attempts.length
        };
      })
    );

    return casePerformance
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, limit);
  }

  async getRecentActivity(educator) {
    // Get recent case attempts by assigned students
    const assignedStudents = await User.find({
      primaryRole: 'student',
      'profile.assignedEducators': educator._id
    }).select('_id').lean();

    const studentIds = assignedStudents.map(s => s._id);

    const recentAttempts = await mongoose.connection.db.collection('case_attempts').find({
      user_id: { $in: studentIds },
      start_time: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).sort({ start_time: -1 }).limit(10).toArray();

    return recentAttempts;
  }

  async getUpcomingDeadlines(educator) {
    // This would integrate with assignment/deadline system
    // For now, return empty array
    return [];
  }

  getQuickActions(educator) {
    return [
      { id: 'create_case', label: 'Create New Case', icon: 'plus', url: '/educator/cases/create' },
      { id: 'view_students', label: 'View Students', icon: 'users', url: '/educator/students' },
      { id: 'case_analytics', label: 'Case Analytics', icon: 'chart', url: '/educator/analytics' },
      { id: 'create_class', label: 'Create Class', icon: 'classroom', url: '/educator/classes/create' }
    ];
  }

  calculateCompetencyScores(caseAttempts) {
    const competencies = {};
    
    caseAttempts.forEach(attempt => {
      if (attempt.detailed_metrics) {
        Object.keys(attempt.detailed_metrics).forEach(competency => {
          if (!competencies[competency]) {
            competencies[competency] = [];
          }
          competencies[competency].push(attempt.detailed_metrics[competency]);
        });
      }
    });

    // Calculate averages
    Object.keys(competencies).forEach(competency => {
      const scores = competencies[competency];
      competencies[competency] = (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1);
    });

    return competencies;
  }

  calculateRecentTrend(caseAttempts) {
    if (caseAttempts.length < 2) return 'stable';

    const sortedAttempts = caseAttempts.sort((a, b) => 
      new Date(a.start_time) - new Date(b.start_time));

    const recentCount = Math.min(5, Math.floor(sortedAttempts.length / 2));
    const recent = sortedAttempts.slice(-recentCount);
    const previous = sortedAttempts.slice(-recentCount * 2, -recentCount);

    if (previous.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0) / recent.length;
    const previousAvg = previous.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0) / previous.length;

    const difference = recentAvg - previousAvg;
    
    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  async calculateImprovementRate(studentIds) {
    // Calculate improvement rate across all students
    let totalImprovement = 0;
    let studentsWithMultipleAttempts = 0;

    for (const studentId of studentIds) {
      const attempts = await mongoose.connection.db.collection('case_attempts').find({
        user_id: studentId,
        status: 'completed'
      }).sort({ start_time: 1 }).toArray();

      if (attempts.length >= 2) {
        const firstScore = attempts[0].score?.overall || 0;
        const lastScore = attempts[attempts.length - 1].score?.overall || 0;
        totalImprovement += (lastScore - firstScore);
        studentsWithMultipleAttempts++;
      }
    }

    return studentsWithMultipleAttempts > 0 
      ? (totalImprovement / studentsWithMultipleAttempts).toFixed(1)
      : 0;
  }

  async getCompetencyProgress(studentIds) {
    const competencyData = {};
    
    for (const studentId of studentIds) {
      const attempts = await mongoose.connection.db.collection('case_attempts').find({
        user_id: studentId,
        status: 'completed'
      }).toArray();

      attempts.forEach(attempt => {
        if (attempt.detailed_metrics) {
          Object.keys(attempt.detailed_metrics).forEach(competency => {
            if (!competencyData[competency]) {
              competencyData[competency] = [];
            }
            competencyData[competency].push(attempt.detailed_metrics[competency]);
          });
        }
      });
    }

    // Calculate averages
    Object.keys(competencyData).forEach(competency => {
      const scores = competencyData[competency];
      competencyData[competency] = (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1);
    });

    return competencyData;
  }

  async getPerformanceTrends(studentIds, months = 6) {
    const trends = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthlyAttempts = await mongoose.connection.db.collection('case_attempts').find({
        user_id: { $in: studentIds },
        status: 'completed',
        start_time: { $gte: monthStart, $lte: monthEnd }
      }).toArray();

      const averageScore = monthlyAttempts.length > 0
        ? monthlyAttempts.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0) / monthlyAttempts.length
        : 0;

      trends.push({
        month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
        averageScore: parseFloat(averageScore.toFixed(1)),
        attemptCount: monthlyAttempts.length
      });
    }

    return trends;
  }

  async getCaseUsageStats(caseId) {
    const attempts = await mongoose.connection.db.collection('case_attempts').find({
      case_id: caseId
    }).toArray();

    const completedAttempts = attempts.filter(attempt => attempt.status === 'completed');
    const uniqueUsers = new Set(attempts.map(attempt => attempt.user_id.toString())).size;

    return {
      totalAttempts: attempts.length,
      completedAttempts: completedAttempts.length,
      uniqueUsers,
      averageScore: completedAttempts.length > 0
        ? (completedAttempts.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0) / completedAttempts.length).toFixed(1)
        : 0
    };
  }

  calculatePerformanceDistribution(caseAttempts) {
    const distribution = {
      excellent: 0, // 90-100
      good: 0,      // 80-89
      average: 0,   // 70-79
      poor: 0       // <70
    };

    caseAttempts.forEach(attempt => {
      const score = attempt.score?.overall || 0;
      if (score >= 90) distribution.excellent++;
      else if (score >= 80) distribution.good++;
      else if (score >= 70) distribution.average++;
      else distribution.poor++;
    });

    return distribution;
  }

  async analyzeCommonMistakes(caseAttempts) {
    // Analyze interaction patterns to identify common mistakes
    const mistakes = {};

    caseAttempts.forEach(attempt => {
      if (attempt.interactions) {
        attempt.interactions.forEach(interaction => {
          if (interaction.score && interaction.score < 0.5) {
            const key = interaction.type + '_' + (interaction.content || 'unknown');
            mistakes[key] = (mistakes[key] || 0) + 1;
          }
        });
      }
    });

    // Return top 5 most common mistakes
    return Object.entries(mistakes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([mistake, count]) => ({ mistake, count }));
  }

  async generateImprovementSuggestions(caseAttempts, caseDoc) {
    const suggestions = [];
    
    // Analyze performance patterns
    const averageScore = caseAttempts.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0) / caseAttempts.length;
    
    if (averageScore < 70) {
      suggestions.push({
        type: 'difficulty',
        message: 'Consider adding more guidance or reducing case complexity',
        priority: 'high'
      });
    }

    const averageTime = caseAttempts.reduce((sum, attempt) => sum + (attempt.time_spent || 0), 0) / caseAttempts.length;
    
    if (averageTime > 3600) { // More than 1 hour
      suggestions.push({
        type: 'time',
        message: 'Students are taking longer than expected. Consider breaking into smaller sections',
        priority: 'medium'
      });
    }

    return suggestions;
  }

  calculateDifficultyRating(caseAttempts) {
    const averageScore = caseAttempts.reduce((sum, attempt) => sum + (attempt.score?.overall || 0), 0) / caseAttempts.length;
    const averageTime = caseAttempts.reduce((sum, attempt) => sum + (attempt.time_spent || 0), 0) / caseAttempts.length;
    
    // Simple difficulty calculation based on score and time
    let difficulty = 5; // Medium difficulty baseline
    
    if (averageScore < 60) difficulty += 2;
    else if (averageScore < 70) difficulty += 1;
    else if (averageScore > 90) difficulty -= 1;
    
    if (averageTime > 3600) difficulty += 1;
    else if (averageTime < 1800) difficulty -= 1;
    
    return Math.max(1, Math.min(10, difficulty));
  }

  async getClassRecentActivity(classId) {
    // Get recent activity for a specific class
    const classDoc = await mongoose.connection.db.collection('classes').findOne({ _id: classId });
    if (!classDoc) return null;

    const recentAttempts = await mongoose.connection.db.collection('case_attempts').find({
      user_id: { $in: classDoc.students },
      start_time: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).sort({ start_time: -1 }).limit(5).toArray();

    return {
      recentAttempts: recentAttempts.length,
      lastActivity: recentAttempts.length > 0 ? recentAttempts[0].start_time : null
    };
  }
}

export default new EducatorDashboardService();
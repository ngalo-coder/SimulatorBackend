import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';

export class AdminStatsService {
  static async getSystemStats(dateFilter = {}) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalCases,
      totalSessions,
      recentUsers,
      activeUsers,
      casesBySpecialty,
      recentSessions,
      userGrowth
    ] = await Promise.all([
      User.countDocuments(dateFilter),
      Case.countDocuments(),
      PerformanceMetrics.countDocuments(dateFilter),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      PerformanceMetrics.distinct('user_ref').then(userIds => userIds.length),
      this.getCasesBySpecialty(),
      PerformanceMetrics.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      this.getUserGrowth(oneYearAgo)
    ]);

    return {
      totalUsers,
      totalCases,
      totalSessions,
      recentUsers,
      activeUsers,
      recentSessions,
      casesBySpecialty,
      userGrowth,
      generatedAt: new Date().toISOString(),
      dateRange: Object.keys(dateFilter).length ? dateFilter : null
    };
  }

  static async getCasesBySpecialty() {
    return Case.aggregate([
      { $group: { _id: '$case_metadata.specialty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
  }

  static async getUserGrowth(since) {
    return User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
  }

  static async getUsersWithScores() {
    return User.aggregate([
      {
        $lookup: {
          from: 'performancemetrics',
          localField: '_id',
          foreignField: 'user_ref',
          as: 'performances'
        }
      },
      {
        $addFields: {
          totalCases: { $size: '$performances' },
          averageScore: {
            $cond: {
              if: { $gt: [{ $size: '$performances' }, 0] },
              then: {
                $avg: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$performances',
                        cond: { $ne: ['$$this.metrics.overall_score', null] }
                      }
                    },
                    as: 'perf',
                    in: '$$perf.metrics.overall_score'
                  }
                }
              },
              else: 0
            }
          },
          excellentCount: {
            $size: {
              $filter: {
                input: '$performances',
                cond: { $eq: ['$$this.metrics.performance_label', 'Excellent'] }
              }
            }
          }
        }
      },
      {
        $project: {
          username: 1,
          email: 1,
          role: 1,
          createdAt: 1,
          totalCases: 1,
          averageScore: { $round: ['$averageScore', 2] },
          excellentCount: 1,
          excellentRate: {
            $cond: {
              if: { $gt: ['$totalCases', 0] },
              then: { $round: [{ $multiply: [{ $divide: ['$excellentCount', '$totalCases'] }, 100] }, 1] },
              else: 0
            }
          }
        }
      },
      { $sort: { averageScore: -1 } }
    ]);
  }
}

export default AdminStatsService;
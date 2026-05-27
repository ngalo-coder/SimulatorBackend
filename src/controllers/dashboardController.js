/**
 * Dashboard Controller
 * Orchestrates dashboard data retrieval for students, educators, and admins
 */

import studentDashboardService from '../services/StudentDashboardService.js';
import educatorDashboardService from '../services/EducatorDashboardService.js';
import adminStatsService from '../services/adminStatsService.js';
import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';

export async function getDashboard(req, res) {
  try {
    const role = req.user?.role;
    let data = {};

    if (role === 'student') {
      const [performanceData, availableCases, progressStats, recommendations] = await Promise.all([
        studentDashboardService.getPerformanceMetrics(req.user),
        studentDashboardService.getAvailableCases(req.user),
        studentDashboardService.getProgressStats(req.user),
        studentDashboardService.getRecommendations(req.user)
      ]);
      data = { performanceData, availableCases, progressStats, recommendations };
    } else if (role === 'educator') {
      const [performanceMetrics, caseStatistics, studentStatistics] = await Promise.all([
        educatorDashboardService.getPerformanceMetrics(req.user),
        educatorDashboardService.getCaseStatistics(req.user),
        educatorDashboardService.getStudentStatistics(req.user)
      ]);
      data = { performanceMetrics, caseStatistics, studentStatistics };
    } else if (role === 'admin') {
      const stats = await adminStatsService.getComprehensiveStats();
      data = stats;
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load dashboard' });
  }
}

export async function getStats(req, res) {
  try {
    const role = req.user?.role;

    if (role === 'student') {
      const progress = await studentDashboardService.getProgressStats(req.user);
      return res.json({ success: true, data: progress });
    } else if (role === 'educator') {
      const [performance, caseStats, studentStats] = await Promise.all([
        educatorDashboardService.getPerformanceMetrics(req.user),
        educatorDashboardService.getCaseStatistics(req.user),
        educatorDashboardService.getStudentStatistics(req.user)
      ]);
      return res.json({ success: true, data: { performance, caseStats, studentStats } });
    } else {
      const [totalUsers, totalCases, totalSessions] = await Promise.all([
        User.countDocuments(),
        Case.countDocuments({ status: 'published' }),
        PerformanceMetrics.countDocuments()
      ]);
      return res.json({ success: true, data: { totalUsers, totalCases, totalSessions } });
    }
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load stats' });
  }
}

export async function getStudentProgress(req, res) {
  try {
    const progress = await studentDashboardService.getProgressStats(req.user);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load progress' });
  }
}

export async function getStudentRecommendations(req, res) {
  try {
    const recommendations = await studentDashboardService.getRecommendations(req.user);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load recommendations' });
  }
}

export async function getActivityFeed(req, res) {
  try {
    const activityFeed = await studentDashboardService.getActivityFeed(req.user);
    res.json({ success: true, data: activityFeed });
  } catch (error) {
    console.error('Get activity feed error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load activity feed' });
  }
}

export async function getEducatorStudents(req, res) {
  try {
    const students = await educatorDashboardService.getStudentList(req.user);
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Get educator students error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load students' });
  }
}

export async function getCaseStatistics(req, res) {
  try {
    const caseStats = await educatorDashboardService.getCaseStatistics(req.user);
    res.json({ success: true, data: caseStats });
  } catch (error) {
    console.error('Get case statistics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load case statistics' });
  }
}

export async function getPerformanceMetrics(req, res) {
  try {
    const performanceMetrics = await educatorDashboardService.getPerformanceMetrics(req.user);
    res.json({ success: true, data: performanceMetrics });
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load performance metrics' });
  }
}

/**
 * Analytics Controller
 * Orchestrates analytics service calls for case usage, effectiveness, performance trends, etc.
 */

import AnalyticsService from '../services/AnalyticsService.js';
import ProgressAnalyticsService from '../services/ProgressAnalyticsService.js';

export async function getCaseUsageAnalytics(req, res) {
  try {
    const { timeRange = '30d', specialty, difficulty, programArea } = req.query;
    const analytics = await AnalyticsService.getCaseUsageAnalytics({
      timeRange,
      specialty: specialty || undefined,
      difficulty: difficulty || undefined,
      programArea: programArea || undefined
    });
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Get case usage analytics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch case usage analytics' });
  }
}

export async function getCaseEffectivenessMetrics(req, res) {
  try {
    const { caseId } = req.query;
    const metrics = await AnalyticsService.getCaseEffectivenessMetrics(caseId || null);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Get case effectiveness metrics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch case effectiveness metrics' });
  }
}

export async function getDifficultyAnalysis(req, res) {
  try {
    const { specialty, programArea } = req.query;
    const analysis = await AnalyticsService.getDifficultyAnalysis({
      specialty: specialty || undefined,
      programArea: programArea || undefined
    });
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Get difficulty analysis error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch difficulty analysis' });
  }
}

export async function getPerformanceTrends(req, res) {
  try {
    const { timeRange = '90d', interval = 'week' } = req.query;
    const trends = await AnalyticsService.getPerformanceTrends(timeRange, interval);
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Get performance trends error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch performance trends' });
  }
}

export async function getContributorAnalytics(req, res) {
  try {
    const analytics = await AnalyticsService.getContributorAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Get contributor analytics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch contributor analytics' });
  }
}

export async function getReviewQualityMetrics(req, res) {
  try {
    const { timeRange = '30d', reviewerId } = req.query;
    const metrics = await AnalyticsService.getReviewQualityMetrics({
      timeRange,
      reviewerId: reviewerId || undefined
    });
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Get review quality metrics error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch review quality metrics' });
  }
}

export async function getRealTimeProgress(req, res) {
  try {
    const { userId } = req.params;
    const { timeRange, granularity } = req.query;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const progressData = await ProgressAnalyticsService.getRealTimeProgress(userId, {
      timeRange: timeRange || '30d',
      granularity: granularity || 'week'
    });
    res.json({ success: true, data: progressData });
  } catch (error) {
    console.error('Get real-time progress error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch real-time progress data' });
  }
}

export async function analyzeCompetencyTrends(req, res) {
  try {
    const { userId } = req.params;
    const { timeRange, granularity } = req.query;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const trendData = await ProgressAnalyticsService.analyzeCompetencyTrends(userId, {
      timeRange: timeRange || '90d',
      granularity: granularity || 'week'
    });
    res.json({ success: true, data: trendData });
  } catch (error) {
    console.error('Analyze competency trends error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to analyze competency trends' });
  }
}

export async function compareToBenchmarks(req, res) {
  try {
    const { userId } = req.params;
    const { specialty, difficulty, programArea } = req.query;

    if (req.user.role === 'student' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const benchmarkData = await ProgressAnalyticsService.compareToBenchmarks(userId, {
      specialty: specialty || undefined,
      difficulty: difficulty || undefined,
      programArea: programArea || undefined
    });
    res.json({ success: true, data: benchmarkData });
  } catch (error) {
    console.error('Compare to benchmarks error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to compare against benchmarks' });
  }
}

export async function predictPerformance(req, res) {
  try {
    const { userId } = req.params;
    const predictions = await ProgressAnalyticsService.predictFuturePerformance(userId);
    res.json({ success: true, data: predictions });
  } catch (error) {
    console.error('Predict performance error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to predict performance' });
  }
}

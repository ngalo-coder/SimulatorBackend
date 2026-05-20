import mongoose from 'mongoose';
import StudentProgress from '../models/StudentProgressModel.js';
import ClinicianProgress from '../models/ClinicianProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';

/**
 * Progress Analytics Service
 * Provides real-time progress calculation, competency trend analysis,
 * performance benchmarking, and predictive analytics for learning outcomes
 */
class ProgressAnalyticsService {
  constructor() {
    this.trendCache = new Map();
    this.cacheDuration = 2 * 60 * 1000; // 2 minutes cache for real-time data
  }

  /**
   * Get real-time progress updates for a user
   * @param {string} userId - User ID
   * @param {Object} options - Options for real-time updates
   * @returns {Promise<Object>} - Real-time progress data
   */
  async getRealTimeProgress(userId, options = {}) {
    try {
      const cacheKey = `realtime_${userId}_${JSON.stringify(options)}`;
      const cached = this.trendCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }

      const [studentProgress, clinicianProgress, recentMetrics] = await Promise.all([
        StudentProgress.findOne({ userId }).lean(),
        ClinicianProgress.findOne({ userId }).lean(),
        this._getRecentPerformanceMetrics(userId, 10)
      ]);

      const progressData = {
        studentProgress: studentProgress || {},
        clinicianProgress: clinicianProgress || {},
        recentPerformance: recentMetrics,
        currentLevel: this._calculateCurrentProficiencyLevel(studentProgress, clinicianProgress),
        progressRate: await this._calculateProgressRate(userId),
        competencyTrends: await this._analyzeCompetencyTrends(userId),
        benchmarkComparison: await this._compareToBenchmarks(userId),
        predictedOutcomes: await this._predictLearningOutcomes(userId),
        lastUpdated: new Date()
      };

      this.trendCache.set(cacheKey, {
        timestamp: Date.now(),
        data: progressData
      });

      return progressData;
    } catch (error) {
      console.error('Get real-time progress error:', error);
      throw error;
    }
  }

  /**
   * Analyze competency trends over time
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Array>} - Competency trend data
   */
  async analyzeCompetencyTrends(userId, options = {}) {
    try {
      const { timeRange = '90d', granularity = 'week' } = options;
      const dateFilter = this._getDateFilter(timeRange);

      const progress = await StudentProgress.findOne({ userId });
      if (!progress || !progress.caseAttempts.length) {
        return [];
      }

      // Group case attempts by time period and analyze competency changes
      const trendData = await this._groupByTimePeriod(progress.caseAttempts, granularity, dateFilter);
      
      return trendData.map(period => ({
        period: period.period,
        averageScore: period.avgScore,
        competencyGrowth: this._calculateCompetencyGrowth(period.competencies),
        improvementRate: this._calculateImprovementRate(period.scores),
        trendDirection: this._determineTrendDirection(period.scores)
      }));
    } catch (error) {
      console.error('Analyze competency trends error:', error);
      throw error;
    }
  }

  /**
   * Compare user performance against benchmarks
   * @param {string} userId - User ID
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} - Benchmark comparison data
   */
  async compareToBenchmarks(userId, options = {}) {
    try {
      const { specialty, difficulty, programArea } = options;
      const userProgress = await StudentProgress.findOne({ userId });
      
      if (!userProgress) {
        throw new Error('User progress not found');
      }

      const [userMetrics, peerMetrics, expertMetrics] = await Promise.all([
        this._getUserPerformanceMetrics(userId),
        this._getPeerBenchmarks(specialty, difficulty, programArea),
        this._getExpertBenchmarks(specialty)
      ]);

      return {
        userPerformance: userMetrics,
        peerComparison: this._compareMetrics(userMetrics, peerMetrics),
        expertGap: this._calculateExpertGap(userMetrics, expertMetrics),
        relativeRanking: await this._calculateRelativeRanking(userMetrics, specialty),
        improvementAreas: this._identifyImprovementAreas(userMetrics, expertMetrics)
      };
    } catch (error) {
      console.error('Compare to benchmarks error:', error);
      throw error;
    }
  }

  /**
   * Predict learning outcomes based on current progress
   * @param {string} userId - User ID
   * @param {Object} options - Prediction options
   * @returns {Promise<Object>} - Predicted outcomes
   */
  async predictLearningOutcomes(userId, options = {}) {
    try {
      const progress = await StudentProgress.findOne({ userId });
      if (!progress) {
        throw new Error('User progress not found');
      }

      const currentCompetencies = progress.competencies;
      const historicalTrend = await this._analyzeHistoricalTrend(userId);
      
      return {
        predictedProficiency: this._predictProficiencyLevel(currentCompetencies, historicalTrend),
        estimatedMasteryTime: this._estimateMasteryTime(currentCompetencies, historicalTrend),
        competencyGapAnalysis: this._analyzeCompetencyGaps(currentCompetencies),
        recommendedLearningPath: await this._generateLearningPath(userId, currentCompetencies),
        confidenceScores: this._calculateConfidenceScores(historicalTrend)
      };
    } catch (error) {
      console.error('Predict learning outcomes error:', error);
      throw error;
    }
  }

  /**
   * Get visualization-ready data for progress dashboard
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Visualization data
   */
  async getVisualizationData(userId) {
    try {
      const [
        realTimeProgress,
        competencyTrends,
        benchmarkComparison,
        predictedOutcomes
      ] = await Promise.all([
        this.getRealTimeProgress(userId),
        this.analyzeCompetencyTrends(userId),
        this.compareToBenchmarks(userId),
        this.predictLearningOutcomes(userId)
      ]);

      return {
        progressCharts: this._formatProgressCharts(realTimeProgress),
        trendGraphs: this._formatTrendGraphs(competencyTrends),
        benchmarkVisualizations: this._formatBenchmarkVisualizations(benchmarkComparison),
        predictionVisualizations: this._formatPredictionVisualizations(predictedOutcomes),
        summaryMetrics: this._generateSummaryMetrics(realTimeProgress, benchmarkComparison)
      };
    } catch (error) {
      console.error('Get visualization data error:', error);
      throw error;
    }
  }

  // Private helper methods

  async _getRecentPerformanceMetrics(userId, limit = 10) {
    return PerformanceMetrics.find({ user_ref: userId })
      .sort({ evaluated_at: -1 })
      .limit(limit)
      .populate('case_ref', 'case_metadata.title case_metadata.difficulty case_metadata.specialty')
      .lean();
  }

  _calculateCurrentProficiencyLevel(studentProgress, clinicianProgress) {
    if (!studentProgress && !clinicianProgress) return 'Novice';
    
    let level = 'Novice';
    
    if (studentProgress?.overallProgress?.currentLevel) {
      level = studentProgress.overallProgress.currentLevel;
    } else if (clinicianProgress?.currentProgressionLevel) {
      level = clinicianProgress.currentProgressionLevel;
    }
    
    return level;
  }

  async _calculateProgressRate(userId) {
    const progress = await StudentProgress.findOne({ userId });
    if (!progress || progress.caseAttempts.length < 2) return 0;

    const attempts = progress.caseAttempts.sort((a, b) => 
      new Date(a.endTime || a.startTime) - new Date(b.endTime || a.startTime)
    );

    const recentScores = attempts.slice(-5).map(a => a.score || 0);
    const previousScores = attempts.slice(-10, -5).map(a => a.score || 0);

    if (previousScores.length === 0) return 0;

    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const previousAvg = previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length;

    return previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
  }

  async _analyzeCompetencyTrends(userId) {
    const progress = await StudentProgress.findOne({ userId });
    if (!progress) return [];

    const competencyTrends = progress.competencies.map(comp => ({
      competencyId: comp.competencyId,
      competencyName: comp.competencyName,
      currentScore: comp.score,
      trend: this._calculateCompetencyTrend(comp),
      growthRate: this._calculateGrowthRate(comp),
      masteryEstimate: this._estimateMasteryTimeForCompetency(comp)
    }));

    return competencyTrends;
  }

  _calculateCompetencyTrend(competency) {
    // Simple trend calculation based on score changes over time
    // In a real implementation, this would analyze historical data
    if (competency.score >= 90) return 'mastered';
    if (competency.score >= 80) return 'improving';
    if (competency.score >= 70) return 'stable';
    if (competency.score >= 60) return 'developing';
    return 'beginner';
  }

  _calculateGrowthRate(competency) {
    // Placeholder for growth rate calculation
    // Would typically analyze historical score progression
    const baseRate = competency.score / 100;
    return Math.min(1, baseRate + 0.1); // Ensure growth rate doesn't exceed 1
  }

  _estimateMasteryTimeForCompetency(competency) {
    const remainingPoints = 100 - competency.score;
    const growthRate = this._calculateGrowthRate(competency);
    return growthRate > 0 ? remainingPoints / (growthRate * 10) : Infinity;
  }

  async _getUserPerformanceMetrics(userId) {
    const metrics = await PerformanceMetrics.aggregate([
      { $match: { user_ref: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$metrics.overall_score' },
          totalAttempts: { $sum: 1 },
          completionRate: {
            $avg: { $cond: [{ $gte: ['$metrics.overall_score', 70] }, 1, 0] }
          },
          avgTimePerCase: { $avg: '$session_duration' }
        }
      }
    ]);

    return metrics[0] || { averageScore: 0, totalAttempts: 0, completionRate: 0, avgTimePerCase: 0 };
  }

  async _getPeerBenchmarks(specialty, difficulty, programArea) {
    const matchStage = {};
    if (specialty) matchStage['caseDetails.case_metadata.specialty'] = specialty;
    if (difficulty) matchStage['caseDetails.case_metadata.difficulty'] = difficulty;
    if (programArea) matchStage['caseDetails.case_metadata.program_area'] = programArea;

    const metrics = await PerformanceMetrics.aggregate([
      {
        $lookup: {
          from: 'cases',
          localField: 'case_ref',
          foreignField: '_id',
          as: 'caseDetails'
        }
      },
      { $unwind: '$caseDetails' },
      { $match: matchStage },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$metrics.overall_score' },
          totalAttempts: { $sum: 1 },
          completionRate: {
            $avg: { $cond: [{ $gte: ['$metrics.overall_score', 70] }, 1, 0] }
          },
          avgTimePerCase: { $avg: '$session_duration' }
        }
      }
    ]);

    return metrics[0] || { averageScore: 0, totalAttempts: 0, completionRate: 0, avgTimePerCase: 0 };
  }

  async _getExpertBenchmarks(specialty) {
    // Placeholder for expert benchmark data
    // In a real implementation, this would fetch from expert performance database
    return {
      averageScore: 92,
      totalAttempts: 150,
      completionRate: 0.95,
      avgTimePerCase: 1800 // 30 minutes in seconds
    };
  }

  _compareMetrics(userMetrics, benchmarkMetrics) {
    return {
      scoreDifference: userMetrics.averageScore - benchmarkMetrics.averageScore,
      completionRateDifference: userMetrics.completionRate - benchmarkMetrics.completionRate,
      timeEfficiency: benchmarkMetrics.avgTimePerCase / (userMetrics.avgTimePerCase || 1),
      relativePerformance: (userMetrics.averageScore / benchmarkMetrics.averageScore) * 100
    };
  }

  _calculateExpertGap(userMetrics, expertMetrics) {
    return {
      scoreGap: expertMetrics.averageScore - userMetrics.averageScore,
      completionGap: expertMetrics.completionRate - userMetrics.completionRate,
      timeEfficiencyGap: (expertMetrics.avgTimePerCase / userMetrics.avgTimePerCase) - 1,
      estimatedTrainingHours: this._estimateTrainingHours(userMetrics, expertMetrics)
    };
  }

  _estimateTrainingHours(userMetrics, expertMetrics) {
    const scoreGap = expertMetrics.averageScore - userMetrics.averageScore;
    const avgImprovementPerHour = 2; // Assumed average improvement per hour of training
    return Math.max(0, scoreGap / avgImprovementPerHour);
  }

  async _calculateRelativeRanking(userMetrics, specialty) {
    // Placeholder for relative ranking calculation
    // Would typically query database for percentile ranking
    const percentile = Math.min(95, (userMetrics.averageScore / 100) * 95);
    return {
      percentile,
      ranking: `Top ${100 - percentile}%`,
      specialtyRanking: specialty ? `Top ${100 - percentile}% in ${specialty}` : 'N/A'
    };
  }

  _identifyImprovementAreas(userMetrics, expertMetrics) {
    const areas = [];
    
    if (userMetrics.averageScore < expertMetrics.averageScore - 10) {
      areas.push('Overall diagnostic accuracy');
    }
    
    if (userMetrics.completionRate < expertMetrics.completionRate - 0.1) {
      areas.push('Case completion consistency');
    }
    
    if (userMetrics.avgTimePerCase > expertMetrics.avgTimePerCase * 1.5) {
      areas.push('Time management efficiency');
    }
    
    return areas;
  }

  async _analyzeHistoricalTrend(userId) {
    const progress = await StudentProgress.findOne({ userId });
    if (!progress) return { trend: 'stable', confidence: 0 };

    const attempts = progress.caseAttempts
      .sort((a, b) => new Date(a.endTime || a.startTime) - new Date(b.endTime || a.startTime))
      .map(attempt => attempt.score || 0);

    if (attempts.length < 3) return { trend: 'stable', confidence: 0 };

    const recentScores = attempts.slice(-5);
    const previousScores = attempts.slice(-10, -5);

    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const previousAvg = previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length;

    let trend = 'stable';
    let confidence = 0.5;

    if (recentAvg > previousAvg + 5) {
      trend = 'improving';
      confidence = Math.min(0.9, (recentAvg - previousAvg) / 20);
    } else if (recentAvg < previousAvg - 5) {
      trend = 'declining';
      confidence = Math.min(0.9, (previousAvg - recentAvg) / 20);
    }

    return { trend, confidence };
  }

  _predictProficiencyLevel(competencies, historicalTrend) {
    const avgScore = competencies.reduce((sum, comp) => sum + comp.score, 0) / competencies.length;
    let predictedLevel = 'Novice';

    if (avgScore >= 90) predictedLevel = 'Expert';
    else if (avgScore >= 80) predictedLevel = 'Proficient';
    else if (avgScore >= 70) predictedLevel = 'Competent';
    else if (avgScore >= 60) predictedLevel = 'Beginner';

    // Adjust based on trend
    if (historicalTrend.trend === 'improving' && historicalTrend.confidence > 0.7) {
      if (predictedLevel === 'Beginner') predictedLevel = 'Competent';
      else if (predictedLevel === 'Competent') predictedLevel = 'Proficient';
    }

    return predictedLevel;
  }

  _estimateMasteryTime(competencies, historicalTrend) {
    const avgScore = competencies.reduce((sum, comp) => sum + comp.score, 0) / competencies.length;
    const pointsToMastery = 100 - avgScore;
    
    let learningRate = 2; // points per week baseline
    if (historicalTrend.trend === 'improving') {
      learningRate *= 1.5;
    } else if (historicalTrend.trend === 'declining') {
      learningRate *= 0.7;
    }

    return Math.max(1, Math.ceil(pointsToMastery / learningRate)); // weeks to mastery
  }

  _analyzeCompetencyGaps(competencies) {
    return competencies
      .filter(comp => comp.score < 80)
      .sort((a, b) => a.score - b.score)
      .map(comp => ({
        competencyId: comp.competencyId,
        competencyName: comp.competencyName,
        currentScore: comp.score,
        gapToMastery: 80 - comp.score,
        priority: comp.score < 60 ? 'high' : comp.score < 70 ? 'medium' : 'low'
      }));
  }

  async _generateLearningPath(userId, competencies) {
    const weakCompetencies = competencies.filter(comp => comp.score < 70);
    const recommendedCases = await Case.find({
      'case_metadata.competencies': { $in: weakCompetencies.map(comp => comp.competencyId) }
    })
    .limit(5)
    .select('case_metadata.title case_metadata.difficulty case_metadata.specialty')
    .lean();

    return {
      focusAreas: weakCompetencies.map(comp => comp.competencyName),
      recommendedCases,
      estimatedDuration: this._estimateMasteryTime(competencies, { trend: 'stable', confidence: 0.5 }),
      priorityOrder: weakCompetencies.sort((a, b) => a.score - b.score).map(comp => comp.competencyName)
    };
  }

  _calculateConfidenceScores(historicalTrend) {
    return {
      trendConfidence: historicalTrend.confidence,
      predictionConfidence: Math.min(0.85, historicalTrend.confidence * 1.2),
      recommendationConfidence: 0.7 // Base confidence for recommendations
    };
  }

  _formatProgressCharts(progressData) {
    return {
      scoreProgression: {
        labels: progressData.recentPerformance.map((_, index) => `Attempt ${index + 1}`),
        datasets: [{
          label: 'Recent Scores',
          data: progressData.recentPerformance.map(metric => metric.metrics?.overall_score || 0),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)'
        }]
      },
      competencyRadar: {
        labels: progressData.competencyTrends.map(comp => comp.competencyName),
        datasets: [{
          label: 'Current Proficiency',
          data: progressData.competencyTrends.map(comp => comp.currentScore),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)'
        }]
      }
    };
  }

  _formatTrendGraphs(trendData) {
    return {
      timeSeries: trendData.map(period => ({
        x: period.period,
        y: period.averageScore,
        trend: period.trendDirection
      })),
      improvementRate: trendData.map(period => ({
        x: period.period,
        y: period.improvementRate
      }))
    };
  }

  _formatBenchmarkVisualizations(benchmarkData) {
    return {
      comparisonRadar: {
        labels: ['Average Score', 'Completion Rate', 'Time Efficiency'],
        datasets: [
          {
            label: 'Your Performance',
            data: [
              benchmarkData.userPerformance.averageScore,
              benchmarkData.userPerformance.completionRate * 100,
              (1 / (benchmarkData.userPerformance.avgTimePerCase / 3600)) * 10 // cases per hour scaled
            ]
          },
          {
            label: 'Peer Average',
            data: [
              benchmarkData.peerComparison.averageScore,
              benchmarkData.peerComparison.completionRate * 100,
              (1 / (benchmarkData.peerComparison.avgTimePerCase / 3600)) * 10
            ]
          }
        ]
      }
    };
  }

  _formatPredictionVisualizations(predictionData) {
    return {
      masteryTimeline: {
        estimatedWeeks: predictionData.estimatedMasteryTime,
        confidence: predictionData.confidenceScores.predictionConfidence
      },
      competencyGaps: predictionData.competencyGapAnalysis.map(gap => ({
        competency: gap.competencyName,
        gap: gap.gapToMastery,
        priority: gap.priority
      }))
    };
  }

  _generateSummaryMetrics(progressData, benchmarkData) {
    return {
      currentScore: progressData.studentProgress?.overallProgress?.overallScore || 0,
      progressRate: progressData.progressRate,
      benchmarkPercentile: benchmarkData.relativeRanking.percentile,
      predictedLevel: progressData.predictedOutcomes?.predictedProficiency || 'Novice',
      weeklyImprovement: `${Math.max(0, progressData.progressRate).toFixed(1)}%`
    };
  }

  _getDateFilter(timeRange) {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '365d':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { $gte: startDate };
  }

  clearCache() {
    this.trendCache.clear();
  }
}

export default new ProgressAnalyticsService();
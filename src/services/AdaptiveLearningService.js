
import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import StudentProgress from '../models/StudentProgressModel.js';
import LearningGoal from '../models/LearningGoalModel.js';
import mongoose from 'mongoose';

/**
 * Adaptive Learning Service
 * Implements adaptive learning algorithms including learning style assessment,
 * difficulty adjustment, spaced repetition, and learning efficiency optimization
 */
class AdaptiveLearningService {
  constructor() {
    this.learningStyles = {
      VISUAL: 'visual',
      AUDITORY: 'auditory',
      KINESTHETIC: 'kinesthetic',
      READING_WRITING: 'reading_writing'
    };

    this.difficultyLevels = {
      BEGINNER: 'beginner',
      INTERMEDIATE: 'intermediate',
      ADVANCED: 'advanced',
      EXPERT: 'expert'
    };

    this.spacedRepetitionIntervals = {
      initial: 1,      // 1 day
      easy: 4,         // 4 days
      medium: 7,       // 7 days
      hard: 14,        // 14 days
      mastery: 30      // 30 days
    };

    this.learningEfficiencyFactors = {
      timeOfDay: 0.3,
      focusLevel: 0.4,
      previousPerformance: 0.3
    };
  }

  /**
   * Assess student's learning style based on interaction patterns
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Learning style assessment results
   */
  async assessLearningStyle(user) {
    try {
      const interactions = await mongoose.connection.db.collection('user_interactions')
        .find({ user_id: user._id })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      const styleScores = {
        [this.learningStyles.VISUAL]: 0,
        [this.learningStyles.AUDITORY]: 0,
        [this.learningStyles.KINESTHETIC]: 0,
        [this.learningStyles.READING_WRITING]: 0
      };

      // Analyze interaction patterns
      interactions.forEach(interaction => {
        if (interaction.content_type === 'video' || interaction.content_type === 'image') {
          styleScores[this.learningStyles.VISUAL] += 2;
        } else if (interaction.content_type === 'audio') {
          styleScores[this.learningStyles.AUDITORY] += 2;
        } else if (interaction.interaction_type === 'practice' || interaction.interaction_type === 'simulation') {
          styleScores[this.learningStyles.KINESTHETIC] += 2;
        } else if (interaction.content_type === 'text') {
          styleScores[this.learningStyles.READING_WRITING] += 2;
        }

        // Time spent analysis
        if (interaction.duration) {
          const minutes = interaction.duration / 60;
          if (interaction.content_type === 'video') {
            styleScores[this.learningStyles.VISUAL] += minutes * 0.1;
          } else if (interaction.content_type === 'text') {
            styleScores[this.learningStyles.READING_WRITING] += minutes * 0.1;
          }
        }
      });

      // Get dominant learning style
      const dominantStyle = Object.keys(styleScores).reduce((a, b) => 
        styleScores[a] > styleScores[b] ? a : b
      );

      // Calculate confidence score (0-100)
      const totalScore = Object.values(styleScores).reduce((sum, score) => sum + score, 0);
      const confidence = totalScore > 0 ? 
        (styleScores[dominantStyle] / totalScore) * 100 : 50;

      return {
        dominantStyle,
        styleScores,
        confidence: Math.round(confidence),
        assessmentDate: new Date(),
        recommendations: this.getLearningStyleRecommendations(dominantStyle)
      };
    } catch (error) {
      console.error('Assess learning style error:', error);
      throw error;
    }
  }

  /**
   * Get recommendations based on learning style
   */
  getLearningStyleRecommendations(learningStyle) {
    const recommendations = {
      [this.learningStyles.VISUAL]: [
        'Use diagrams and flowcharts for complex concepts',
        'Watch video demonstrations of procedures',
        'Utilize color-coding for different topics',
        'Create mind maps for study organization'
      ],
      [this.learningStyles.AUDITORY]: [
        'Listen to recorded lectures and explanations',
        'Participate in group discussions',
        'Use mnemonic devices and rhymes',
        'Explain concepts out loud to reinforce learning'
      ],
      [this.learningStyles.KINESTHETIC]: [
        'Practice with hands-on simulations',
        'Use physical models when available',
        'Take frequent short breaks during study sessions',
        'Incorporate movement into learning activities'
      ],
      [this.learningStyles.READING_WRITING]: [
        'Take detailed notes during study sessions',
        'Read textbooks and reference materials',
        'Write summaries of key concepts',
        'Create flashcards for important information'
      ]
    };

    return recommendations[learningStyle] || recommendations[this.learningStyles.VISUAL];
  }

  /**
   * Adjust case difficulty based on student performance
   * @param {Object} user - User object
   * @param {Object} caseDoc - Case document
   * @param {number} performanceScore - Recent performance score (0-100)
   * @returns {Promise<Object>} - Adjusted difficulty settings
   */
  async adjustDifficulty(user, caseDoc, performanceScore) {
    try {
      const studentProgress = await StudentProgress.findOne({ userId: user._id });
      const historicalPerformance = await this.getHistoricalPerformance(user);

      const baseDifficulty = caseDoc.case_metadata?.difficulty || this.difficultyLevels.INTERMEDIATE;
      const adjustment = this.calculateDifficultyAdjustment(
        performanceScore,
        historicalPerformance,
        baseDifficulty
      );

      const adjustedDifficulty = this.applyDifficultyAdjustment(baseDifficulty, adjustment);
      const confidence = this.calculateAdjustmentConfidence(historicalPerformance);

      return {
        originalDifficulty: baseDifficulty,
        adjustedDifficulty,
        adjustmentReason: this.generateAdjustmentReason(performanceScore, adjustment),
        confidence,
        recommendedCases: await this.findSimilarDifficultyCases(adjustedDifficulty, caseDoc)
      };
    } catch (error) {
      console.error('Adjust difficulty error:', error);
      throw error;
    }
  }

  /**
   * Calculate difficulty adjustment based on performance
   */
  calculateDifficultyAdjustment(performanceScore, historicalPerformance, baseDifficulty) {
    const difficultyLevels = Object.values(this.difficultyLevels);
    const currentIndex = difficultyLevels.indexOf(baseDifficulty);

    if (performanceScore >= 85) {
      // Excellent performance - increase difficulty
      return Math.min(2, difficultyLevels.length - currentIndex - 1);
    } else if (performanceScore >= 70) {
      // Good performance - maintain or slight increase
      return Math.min(1, difficultyLevels.length - currentIndex - 1);
    } else if (performanceScore >= 60) {
      // Average performance - maintain
      return 0;
    } else if (performanceScore >= 50) {
      // Below average - consider decrease
      return Math.max(-1, -currentIndex);
    } else {
      // Poor performance - decrease difficulty
      return Math.max(-2, -currentIndex);
    }
  }

  /**
   * Apply difficulty adjustment
   */
  applyDifficultyAdjustment(baseDifficulty, adjustment) {
    const difficultyLevels = Object.values(this.difficultyLevels);
    const currentIndex = difficultyLevels.indexOf(baseDifficulty);
    const newIndex = Math.max(0, Math.min(difficultyLevels.length - 1, currentIndex + adjustment));
    return difficultyLevels[newIndex];
  }

  /**
   * Calculate confidence in difficulty adjustment
   */
  calculateAdjustmentConfidence(historicalPerformance) {
    if (historicalPerformance.attempts < 5) return 50; // Low confidence for new students
    
    const consistency = this.calculatePerformanceConsistency(historicalPerformance.scores);
    const trend = this.calculatePerformanceTrend(historicalPerformance.scores);
    
    return Math.min(95, 50 + (consistency * 0.3 + trend * 0.2) * 100);
  }

  /**
   * Calculate performance consistency
   */
  calculatePerformanceConsistency(scores) {
    if (scores.length < 2) return 0.5;
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // Higher consistency = lower standard deviation relative to average
    return 1 - (stdDev / average);
  }

  /**
   * Calculate performance trend
   */
  calculatePerformanceTrend(scores) {
    if (scores.length < 3) return 0;
    
    const recentScores = scores.slice(-5); // Last 5 attempts
    const weights = [0.1, 0.15, 0.2, 0.25, 0.3]; // Weight recent performances more
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < recentScores.length; i++) {
      weightedSum += recentScores[i] * weights[i];
      totalWeight += weights[i];
    }
    
    const weightedAverage = weightedSum / totalWeight;
    const overallAverage = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    
    return (weightedAverage - overallAverage) / 100; // Normalize to -1 to 1
  }

  /**
   * Generate adjustment reason
   */
  generateAdjustmentReason(performanceScore, adjustment) {
    if (adjustment > 0) {
      return `Excellent performance (${performanceScore}%) - increasing difficulty to provide appropriate challenge`;
    } else if (adjustment < 0) {
      return `Performance below expectations (${performanceScore}%) - reducing difficulty to build foundational skills`;
    } else {
      return `Performance at expected level (${performanceScore}%) - maintaining current difficulty`;
    }
  }

  /**
   * Find cases with similar difficulty
   */
  async findSimilarDifficultyCases(difficulty, currentCase) {
    const similarCases = await Case.find({
      'case_metadata.difficulty': difficulty,
      'case_metadata.specialty': currentCase.case_metadata?.specialty,
      _id: { $ne: currentCase._id }
    })
    .limit(5)
    .lean();

    return similarCases.map(caseDoc => ({
      id: caseDoc._id,
      title: caseDoc.case_metadata?.title,
      description: caseDoc.description,
      similarity: this.calculateCaseSimilarity(currentCase, caseDoc)
    }));
  }

  /**
   * Calculate case similarity
   */
  calculateCaseSimilarity(case1, case2) {
    let similarity = 0;
    
    // Specialty similarity
    if (case1.case_metadata?.specialty === case2.case_metadata?.specialty) {
      similarity += 0.4;
    }
    
    // Competency similarity
    const comp1 = case1.case_metadata?.competencies || [];
    const comp2 = case2.case_metadata?.competencies || [];
    const commonCompetencies = comp1.filter(comp => comp2.includes(comp));
    similarity += (commonCompetencies.length / Math.max(comp1.length, comp2.length)) * 0.3;
    
    // Patient profile similarity
    if (case1.patient_persona?.age_group === case2.patient_persona?.age_group) {
      similarity += 0.2;
    }
    if (case1.patient_persona?.gender === case2.patient_persona?.gender) {
      similarity += 0.1;
    }
    
    return Math.round(similarity * 100);
  }

  /**
   * Implement spaced repetition scheduling
   * @param {Object} user - User object
   * @param {string} competency - Competency to review
   * @param {number} performanceScore - Most recent performance score
   * @returns {Promise<Object>} - Spaced repetition schedule
   */
  async scheduleSpacedRepetition(user, competency, performanceScore) {
    try {
      const repetitionHistory = await this.getRepetitionHistory(user, competency);
      const nextInterval = this.calculateNextInterval(performanceScore, repetitionHistory);
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);

      const schedule = {
        competency,
        nextReviewDate,
        interval: nextInterval,
        performanceScore,
        confidence: this.calculateRepetitionConfidence(repetitionHistory),
        recommendedActivities: this.getRepetitionActivities(competency, performanceScore)
      };

      // Save schedule
      await this.saveRepetitionSchedule(user, schedule);

      return schedule;
    } catch (error) {
      console.error('Schedule spaced repetition error:', error);
      throw error;
    }
  }

  /**
   * Calculate next repetition interval
   */
  calculateNextInterval(performanceScore, repetitionHistory) {
    if (repetitionHistory.length === 0) {
      return this.spacedRepetitionIntervals.initial;
    }

    const lastInterval = repetitionHistory[repetitionHistory.length - 1].interval;
    
    if (performanceScore >= 90) {
      // Excellent recall - significantly increase interval
      return Math.min(
        this.spacedRepetitionIntervals.mastery,
        Math.round(lastInterval * 2.5)
      );
    } else if (performanceScore >= 80) {
      // Good recall - moderate increase
      return Math.min(
        this.spacedRepetitionIntervals.hard,
        Math.round(lastInterval * 2.0)
      );
    } else if (performanceScore >= 70) {
      // Average recall - slight increase
      return Math.min(
        this.spacedRepetitionIntervals.medium,
        Math.round(lastInterval * 1.5)
      );
    } else if (performanceScore >= 60) {
      // Below average - maintain interval
      return lastInterval;
    } else {
      // Poor recall - decrease interval
      return Math.max(
        this.spacedRepetitionIntervals.initial,
        Math.round(lastInterval * 0.7)
      );
    }
  }

  /**
   * Calculate repetition confidence
   */
  calculateRepetitionConfidence(repetitionHistory) {
    if (repetitionHistory.length < 3) return 60;
    
    const recentScores = repetitionHistory.slice(-3).map(entry => entry.performanceScore);
    const averageScore = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const consistency = this.calculatePerformanceConsistency(recentScores);
    
    return Math.min(95, 50 + (averageScore * 0.3 + consistency * 0.2));
  }

  /**
   * Get repetition activities
   */
  getRepetitionActivities(competency, performanceScore) {
    const activities = {
      high: [
        'Quick review of key concepts',
        'Practice with advanced scenarios',
        'Teach-back exercise'
      ],
      medium: [
        'Focused practice sessions',
        'Case-based application',
        'Self-assessment quiz'
      ],
      low: [
        'Fundamental concept review',
        'Step-by-step guided practice',
        'Basic skill reinforcement'
      ]
    };

    const level = performanceScore >= 80 ? 'high' : performanceScore >= 60 ? 'medium' : 'low';
    return activities[level];
  }

  /**
   * Optimize learning efficiency
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Learning efficiency recommendations
   */
  async optimizeLearningEfficiency(user) {
    try {
      const [learningPatterns, performanceData, scheduleAnalysis] = await Promise.all([
        this.analyzeLearningPatterns(user),
        this.analyzePerformancePatterns(user),
        this.analyzeScheduleEfficiency(user)
      ]);

      const efficiencyScore = this.calculateEfficiencyScore(learningPatterns, performanceData, scheduleAnalysis);
      const recommendations = this.generateEfficiencyRecommendations(
        learningPatterns,
        performanceData,
        scheduleAnalysis,
        efficiencyScore
      );

      return {
        efficiencyScore: Math.round(efficiencyScore),
        learningPatterns,
        performanceData,
        scheduleAnalysis,
        recommendations,
        lastOptimized: new Date()
      };
    } catch (error) {
      console.error('Optimize learning efficiency error:', error);
      throw error;
    }
  }

  /**
   * Analyze learning patterns
   */
  async analyzeLearningPatterns(user) {
    const interactions = await mongoose.connection.db.collection('user_interactions')
      .find({ user_id: user._id })
      .sort({ timestamp: -1 })
      .limit(200)
      .toArray();

    const patterns = {
      preferredTime: this.analyzePreferredTime(interactions),
      sessionDuration: this.analyzeSessionDuration(interactions),
      contentPreferences: this.analyzeContentPreferences(interactions),
      breakPatterns: this.analyzeBreakPatterns(interactions)
    };

    return patterns;
  }

  /**
   * Analyze preferred learning time
   */
  analyzePreferredTime(interactions) {
    const timeSlots = {
      morning: 0,    // 5am - 12pm
      afternoon: 0,  // 12pm - 5pm
      evening: 0,    // 5pm - 10pm
      night: 0       // 10pm - 5am
    };

    interactions.forEach(interaction => {
      const hour = new Date(interaction.timestamp).getHours();
      if (hour >= 5 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
      else if (hour >= 17 && hour < 22) timeSlots.evening++;
      else timeSlots.night++;
    });

    const total = Object.values(timeSlots).reduce((sum, count) => sum + count, 0);
    const percentages = {};
    Object.keys(timeSlots).forEach(slot => {
      percentages[slot] = Math.round((timeSlots[slot] / total) * 100);
    });

    return {
      percentages,
      recommendedSlot: Object.keys(percentages).reduce((a, b) => 
        percentages[a] > percentages[b] ? a : b
      )
    };
  }

  /**
   * Analyze session duration patterns
   */
  analyzeSessionDuration(interactions) {
    const sessions = this.groupIntoLearningSessions(interactions);
    const durations = sessions.map(session => session.duration / 60); // Convert to minutes
    
    if (durations.length === 0) {
      return {
        averageDuration: 45,
        optimalDuration: 45,
        recommendedBreakInterval: 25,
        sessionPattern: 'unknown'
      };
    }

    const averageDuration = durations.reduce((sum, dur) => sum + dur, 0) / durations.length;
    const optimalDuration = Math.min(90, Math.max(30, Math.round(averageDuration * 1.2)));
    const recommendedBreakInterval = Math.max(20, Math.min(optimalDuration - 10, 45));

    let sessionPattern = 'consistent';
    if (durations.length > 5) {
      const variance = durations.reduce((sum, dur) => sum + Math.pow(dur - averageDuration, 2), 0) / durations.length;
      if (variance > 100) sessionPattern = 'variable';
      else if (variance > 25) sessionPattern = 'moderate';
    }

    return {
      averageDuration: Math.round(averageDuration),
      optimalDuration,
      recommendedBreakInterval,
      sessionPattern,
      totalSessions: durations.length
    };
  }

  /**
   * Group interactions into learning sessions
   */
  groupIntoLearningSessions(interactions) {
    if (interactions.length === 0) return [];
    
    const sessions = [];
    let currentSession = {
      startTime: interactions[0].timestamp,
      endTime: interactions[0].timestamp,
      interactions: [interactions[0]]
    };

    for (let i = 1; i < interactions.length; i++) {
      const currentTime = new Date(interactions[i].timestamp);
      const lastTime = new Date(currentSession.endTime);
      const timeDiff = (currentTime - lastTime) / (1000 * 60); // minutes

      if (timeDiff <= 30) { // Same session if break is less than 30 minutes
        currentSession.endTime = interactions[i].timestamp;
        currentSession.interactions.push(interactions[i]);
      } else {
        // Finalize current session
        currentSession.duration = (new Date(currentSession.endTime) - new Date(currentSession.startTime)) / (1000 * 60);
        sessions.push(currentSession);
        
        // Start new session
        currentSession = {
          startTime: interactions[i].timestamp,
          endTime: interactions[i].timestamp,
          interactions: [interactions[i]]
        };
      }
    }

    // Add the last session
    currentSession.duration = (new Date(currentSession.endTime) - new Date(currentSession.startTime)) / (1000 * 60);
    sessions.push(currentSession);

    return sessions;
  }

  /**
   * Analyze content preferences
   */
  analyzeContentPreferences(interactions) {
    const contentTypeCount = {};
    const total = interactions.length;

    interactions.forEach(interaction => {
      const type = interaction.content_type || 'unknown';
      contentTypeCount[type] = (contentTypeCount[type] || 0) + 1;
    });

    const percentages = {};
    Object.keys(contentTypeCount).forEach(type => {
      percentages[type] = Math.round((contentTypeCount[type] / total) * 100);
    });

    return {
      percentages,
      preferredContent: Object.keys(percentages).reduce((a, b) =>
        percentages[a] > percentages[b] ? a : b
      )
    };
  }

  /**
   * Analyze break patterns
   */
  analyzeBreakPatterns(interactions) {
    const sessions = this.groupIntoLearningSessions(interactions);
    if (sessions.length < 2) {
      return {
        averageBreakLength: 60,
        recommendedBreakLength: 60,
        breakPattern: 'insufficient_data'
      };
    }

    const breaks = [];
    for (let i = 1; i < sessions.length; i++) {
      const breakLength = (new Date(sessions[i].startTime) - new Date(sessions[i-1].endTime)) / (1000 * 60);
      breaks.push(breakLength);
    }

    const averageBreak = breaks.reduce((sum, brk) => sum + brk, 0) / breaks.length;
    const recommendedBreak = Math.max(15, Math.min(120, Math.round(averageBreak * 0.8)));

    return {
      averageBreakLength: Math.round(averageBreak),
      recommendedBreakLength: recommendedBreak,
      breakPattern: this.determineBreakPattern(breaks),
      totalBreaks: breaks.length
    };
  }

  determineBreakPattern(breaks) {
    const average = breaks.reduce((sum, brk) => sum + brk, 0) / breaks.length;
    const variance = breaks.reduce((sum, brk) => sum + Math.pow(brk - average, 2), 0) / breaks.length;
    
    if (variance > 1000) return 'highly_variable';
    if (variance > 200) return 'variable';
    if (average > 120) return 'long_breaks';
    if (average < 30) return 'short_breaks';
    return 'consistent';
  }

  /**
   * Get historical performance data
   */
  async getHistoricalPerformance(user) {
    const progressRecords = await StudentProgress.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const scores = progressRecords
      .filter(record => record.performanceScore)
      .map(record => record.performanceScore);

    return {
      scores,
      attempts: scores.length,
      averageScore: scores.length > 0 ?
        scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Get repetition history for a competency
   */
  async getRepetitionHistory(user, competency) {
    const history = await mongoose.connection.db.collection('repetition_schedules')
      .find({
        user_id: user._id,
        competency: competency
      })
      .sort({ nextReviewDate: -1 })
      .limit(10)
      .toArray();

    return history.map(entry => ({
      performanceScore: entry.performanceScore,
      interval: entry.interval,
      reviewDate: entry.nextReviewDate
    }));
  }

  /**
   * Save repetition schedule
   */
  async saveRepetitionSchedule(user, schedule) {
    await mongoose.connection.db.collection('repetition_schedules').insertOne({
      user_id: user._id,
      competency: schedule.competency,
      nextReviewDate: schedule.nextReviewDate,
      interval: schedule.interval,
      performanceScore: schedule.performanceScore,
      confidence: schedule.confidence,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  /**
   * Analyze performance patterns
   */
  async analyzePerformancePatterns(user) {
    const progressRecords = await StudentProgress.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const hourlyPerformance = {};
    const dailyPerformance = {};
    const weeklyTrend = Array(7).fill(0).map(() => ({ count: 0, total: 0 }));

    progressRecords.forEach(record => {
      if (!record.performanceScore) return;

      const date = new Date(record.createdAt);
      const hour = date.getHours();
      const day = date.getDay();
      const hourKey = `${hour}:00-${hour + 1}:00`;

      // Hourly performance
      if (!hourlyPerformance[hourKey]) {
        hourlyPerformance[hourKey] = { count: 0, total: 0 };
      }
      hourlyPerformance[hourKey].count++;
      hourlyPerformance[hourKey].total += record.performanceScore;

      // Weekly performance
      weeklyTrend[day].count++;
      weeklyTrend[day].total += record.performanceScore;
    });

    // Calculate averages
    const hourlyAverages = {};
    Object.keys(hourlyPerformance).forEach(hour => {
      hourlyAverages[hour] = Math.round(hourlyPerformance[hour].total / hourlyPerformance[hour].count);
    });

    const dailyAverages = weeklyTrend.map(day =>
      day.count > 0 ? Math.round(day.total / day.count) : 0
    );

    return {
      hourlyAverages,
      dailyAverages,
      bestPerformingHour: Object.keys(hourlyAverages).reduce((a, b) =>
        hourlyAverages[a] > hourlyAverages[b] ? a : b
      ),
      bestPerformingDay: dailyAverages.reduce((maxIndex, current, index, array) =>
        current > array[maxIndex] ? index : maxIndex, 0
      )
    };
  }

  /**
   * Analyze schedule efficiency
   */
  async analyzeScheduleEfficiency(user) {
    const [learningPatterns, performancePatterns] = await Promise.all([
      this.analyzeLearningPatterns(user),
      this.analyzePerformancePatterns(user)
    ]);

    const alignmentScore = this.calculateScheduleAlignment(
      learningPatterns.preferredTime,
      performancePatterns.hourlyAverages
    );

    return {
      alignmentScore: Math.round(alignmentScore),
      recommendedSchedule: this.generateRecommendedSchedule(
        learningPatterns,
        performancePatterns
      ),
      efficiencyGap: this.calculateEfficiencyGap(learningPatterns, performancePatterns)
    };
  }

  calculateScheduleAlignment(preferredTime, hourlyAverages) {
    const preferredHour = this.getHourFromTimeSlot(preferredTime.recommendedSlot);
    let bestScore = 0;

    Object.keys(hourlyAverages).forEach(hourRange => {
      const hour = parseInt(hourRange.split(':')[0]);
      const score = hourlyAverages[hourRange];
      const timeDiff = Math.abs(hour - preferredHour);
      const alignment = score * (1 - (timeDiff / 24));
      
      if (alignment > bestScore) {
        bestScore = alignment;
      }
    });

    return Math.min(100, bestScore * 1.2);
  }

  getHourFromTimeSlot(slot) {
    switch (slot) {
      case 'morning': return 8;   // 8 AM
      case 'afternoon': return 14; // 2 PM
      case 'evening': return 19;   // 7 PM
      case 'night': return 22;     // 10 PM
      default: return 12;          // Noon
    }
  }

  calculateEfficiencyGap(learningPatterns, performancePatterns) {
    const preferredHour = this.getHourFromTimeSlot(learningPatterns.preferredTime.recommendedSlot);
    const bestPerformanceHour = parseInt(performancePatterns.bestPerformingHour.split(':')[0]);
    
    return Math.abs(preferredHour - bestPerformanceHour);
  }

  generateRecommendedSchedule(learningPatterns, performancePatterns) {
    const optimalStart = this.getOptimalStartTime(
      learningPatterns.preferredTime.recommendedSlot,
      performancePatterns.bestPerformingHour
    );

    return {
      optimalStartTime: optimalStart,
      sessionLength: learningPatterns.sessionDuration.optimalDuration,
      breakInterval: learningPatterns.sessionDuration.recommendedBreakInterval,
      dailySessions: this.calculateOptimalSessions(learningPatterns),
      weeklyDistribution: this.generateWeeklyDistribution(performancePatterns.dailyAverages)
    };
  }

  getOptimalStartTime(preferredSlot, bestPerformingHour) {
    // Prefer the time that aligns both preference and performance
    const preferredHour = this.getHourFromTimeSlot(preferredSlot);
    const bestHour = parseInt(bestPerformingHour.split(':')[0]);
    
    return Math.round((preferredHour + bestHour) / 2);
  }

  calculateOptimalSessions(learningPatterns) {
    const optimalDailyTime = 4 * 60; // 4 hours in minutes
    const sessionLength = learningPatterns.sessionDuration.optimalDuration;
    const breakLength = learningPatterns.sessionDuration.recommendedBreakInterval;
    
    const sessions = Math.floor(optimalDailyTime / (sessionLength + breakLength));
    return Math.max(1, Math.min(4, sessions));
  }

  generateWeeklyDistribution(dailyAverages) {
    const total = dailyAverages.reduce((sum, avg) => sum + avg, 0);
    const distribution = dailyAverages.map(avg =>
      Math.round((avg / total) * 100)
    );
    
    return distribution;
  }

  /**
   * Calculate overall efficiency score
   */
  calculateEfficiencyScore(learningPatterns, performanceData, scheduleAnalysis) {
    const timeAlignment = scheduleAnalysis.alignmentScore / 100;
    const sessionEfficiency = this.calculateSessionEfficiency(learningPatterns.sessionDuration);
    const breakEfficiency = this.calculateBreakEfficiency(learningPatterns.breakPatterns);
    const contentEfficiency = this.calculateContentEfficiency(learningPatterns.contentPreferences);

    return (timeAlignment * 0.3 +
            sessionEfficiency * 0.25 +
            breakEfficiency * 0.2 +
            contentEfficiency * 0.25) * 100;
  }

  calculateSessionEfficiency(sessionDuration) {
    const optimalRange = sessionDuration.averageDuration >= 30 && sessionDuration.averageDuration <= 90;
    const consistency = sessionDuration.sessionPattern === 'consistent' ? 0.8 : 0.5;
    
    return optimalRange ? 0.9 * consistency : 0.6 * consistency;
  }

  calculateBreakEfficiency(breakPatterns) {
    if (breakPatterns.breakPattern === 'consistent') return 0.9;
    if (breakPatterns.breakPattern === 'short_breaks') return 0.7;
    if (breakPatterns.breakPattern === 'long_breaks') return 0.5;
    return 0.3; // highly_variable or variable
  }

  calculateContentEfficiency(contentPreferences) {
    // Higher efficiency if user has clear content preferences
    const maxPreference = Math.max(...Object.values(contentPreferences.percentages));
    return maxPreference >= 40 ? 0.8 : 0.5;
  }

  /**
   * Generate efficiency recommendations
   */
  generateEfficiencyRecommendations(learningPatterns, performanceData, scheduleAnalysis, efficiencyScore) {
    const recommendations = [];

    // Time alignment recommendations
    if (scheduleAnalysis.efficiencyGap > 3) {
      recommendations.push({
        category: 'schedule_alignment',
        priority: 'high',
        message: `Consider adjusting your study schedule. Your best performance occurs at ${performanceData.bestPerformingHour}, but you prefer studying in the ${learningPatterns.preferredTime.recommendedSlot}.`
      });
    }

    // Session duration recommendations
    if (learningPatterns.sessionDuration.averageDuration < 30) {
      recommendations.push({
        category: 'session_length',
        priority: 'medium',
        message: 'Try extending your study sessions to at least 30 minutes for better knowledge retention.'
      });
    } else if (learningPatterns.sessionDuration.averageDuration > 90) {
      recommendations.push({
        category: 'session_length',
        priority: 'medium',
        message: 'Consider breaking long study sessions into shorter, focused intervals to maintain concentration.'
      });
    }

    // Break pattern recommendations
    if (learningPatterns.breakPatterns.breakPattern === 'long_breaks') {
      recommendations.push({
        category: 'break_patterns',
        priority: 'medium',
        message: `Your breaks are longer than optimal. Try keeping breaks to ${learningPatterns.sessionDuration.recommendedBreakInterval} minutes for better continuity.`
      });
    }

    // Content preference recommendations
    const maxContent = Math.max(...Object.values(learningPatterns.contentPreferences.percentages));
    if (maxContent < 30) {
      recommendations.push({
        category: 'content_variety',
        priority: 'low',
        message: 'You use a wide variety of content types. Consider focusing on your most effective learning materials.'
      });
    }

    return recommendations;
  }
}

export default new AdaptiveLearningService();
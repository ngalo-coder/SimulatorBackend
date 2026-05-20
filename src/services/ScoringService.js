import ScoringRubric from '../models/ScoringRubricModel.js';
import SessionModel from '../models/SessionModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import CompetencyAssessment from '../models/CompetencyAssessmentModel.js';
import logger from '../config/logger.js';
import AIEvaluationService from './AIEvaluationService.js';

class ScoringService {
  constructor() {
    this.rubricCache = new Map();
    this.unifiedRubric = this._getUnifiedRubric();
  }

  // Score a session using the appropriate rubric
  async scoreSession(sessionId, rubricId = null, evaluatorId = null) {
    try {
      const session = await SessionModel.findById(sessionId)
        .populate('caseId')
        .populate('userId');

      if (!session) {
        throw new Error('Session not found');
      }

      // Get or determine the appropriate rubric
      const rubric = this.unifiedRubric;
      if (!rubric) {
        throw new Error('No suitable scoring rubric found for this session');
      }

      // Get performance metrics
      let performanceMetrics = await PerformanceMetrics.findOne({ sessionId });
      if (!performanceMetrics) {
        throw new Error('Performance metrics not found for session');
      }

      // Calculate scores using the rubric
      const scoringResult = await this._calculateScores(session, performanceMetrics, rubric);

      // Apply AI-powered evaluation if available
      if (AIEvaluationService.isAvailable()) {
        const aiEvaluation = await AIEvaluationService.evaluateSession(sessionId);
        scoringResult.aiEvaluation = aiEvaluation;
        scoringResult.finalScore = this._integrateAIEvaluation(
          scoringResult.calculatedScore,
          aiEvaluation,
          scoringResult.interactionLevel
        );
      } else {
        scoringResult.finalScore = scoringResult.calculatedScore;
      }

      // Determine performance level with interaction context
      scoringResult.performanceLevel = rubric.determinePerformanceLevel(
        scoringResult.finalScore,
        scoringResult.interactionLevel
      );

      // Update session with scoring results
      session.scoringResults = {
        rubricId: rubric.rubricId,
        finalScore: scoringResult.finalScore,
        performanceLevel: scoringResult.performanceLevel,
        criteriaScores: scoringResult.criteriaScores,
        evaluatedAt: new Date(),
        evaluatorId: evaluatorId
      };

      await session.save();

      // Update competency assessment
      await this._updateCompetencyAssessment(session.userId, scoringResult, rubric);

      logger.info({ 
        sessionId, 
        rubricId: rubric.rubricId, 
        finalScore: scoringResult.finalScore 
      }, 'Session scored successfully');

      return scoringResult;
    } catch (error) {
      logger.error({ sessionId, error: error.message }, 'Error scoring session');
      throw error;
    }
  }

  // Calculate scores based on rubric criteria with interaction level weighting
  async _calculateScores(session, performanceMetrics, rubric) {
    const criteriaScores = [];
    let totalCalculatedScore = 0;

    // Calculate interaction level and apply appropriate weighting
    const interactionLevel = this._calculateInteractionLevel(session, performanceMetrics);
    const interactionMultiplier = this._getInteractionMultiplier(interactionLevel);

    // Evaluate each competency area and criteria
    for (const area of rubric.competencyAreas) {
      for (const criterion of area.criteria) {
        const baseScore = await this._evaluateCriterion(
          criterion,
          session,
          performanceMetrics
        );

        // Apply interaction level weighting
        const adjustedScore = baseScore * interactionMultiplier;

        criteriaScores.push({
          area: area.area,
          criterionId: criterion.criterionId,
          criterionName: criterion.description,
          baseScore: baseScore,
          adjustedScore: adjustedScore,
          maxScore: criterion.maxScore,
          weight: criterion.weight,
          interactionLevel: interactionLevel
        });

        totalCalculatedScore += (adjustedScore / criterion.maxScore) * criterion.weight;
      }
    }

    // Calculate overall score using rubric's method
    const calculatedScore = rubric.calculateScore(criteriaScores);

    return {
      calculatedScore,
      criteriaScores,
      rubricVersion: rubric.version,
      interactionLevel: interactionLevel,
      interactionMultiplier: interactionMultiplier
    };
  }

  // Calculate interaction level based on user engagement
  _calculateInteractionLevel(session, performanceMetrics) {
    const metrics = performanceMetrics || {};
    const messages = session?.messages || [];
    const userMessages = messages.filter(m => m.role === 'user');

    // Count different types of interactions
    const questionsAsked = userMessages.length;
    const totalInteractions = messages.length;
    const sessionDuration = session?.duration || 0; // in minutes

    // Calculate engagement metrics
    const messageFrequency = totalInteractions / Math.max(sessionDuration, 1);
    const questionQuality = this._assessQuestionQuality(userMessages);
    const sessionEngagement = Math.min(questionsAsked / 10, 1); // Normalize to 0-1

    // Determine interaction level
    let interactionLevel = 'minimal';

    if (questionsAsked >= 15 && questionQuality > 0.7 && messageFrequency > 2) {
      interactionLevel = 'extensive';
    } else if (questionsAsked >= 10 && questionQuality > 0.6 && messageFrequency > 1.5) {
      interactionLevel = 'thorough';
    } else if (questionsAsked >= 5 && questionQuality > 0.5 && messageFrequency > 1) {
      interactionLevel = 'adequate';
    } else if (questionsAsked >= 2 && sessionDuration > 5) {
      interactionLevel = 'basic';
    }

    return interactionLevel;
  }

  // Assess the quality of questions asked
  _assessQuestionQuality(userMessages) {
    if (userMessages.length === 0) return 0;

    let qualityScore = 0;
    const clinicalKeywords = [
      'symptom', 'pain', 'fever', 'nausea', 'dizzy', 'headache', 'chest pain',
      'blood pressure', 'heart rate', 'temperature', 'examination', 'auscultation',
      'palpation', 'percussion', 'diagnosis', 'treatment', 'medication', 'history'
    ];

    userMessages.forEach(message => {
      const content = message.content?.toLowerCase() || '';
      const foundKeywords = clinicalKeywords.filter(keyword => content.includes(keyword));

      // Score based on clinical relevance and specificity
      if (foundKeywords.length > 0) {
        qualityScore += Math.min(foundKeywords.length / 3, 1); // Up to 1 point per message
      }

      // Bonus for specific clinical questions
      if (content.includes('history') || content.includes('examination') || content.includes('diagnosis')) {
        qualityScore += 0.2;
      }
    });

    return Math.min(qualityScore / userMessages.length, 1);
  }

  // Get multiplier based on interaction level
  _getInteractionMultiplier(interactionLevel) {
    const multipliers = {
      'minimal': 0.6,      // 40% penalty for minimal interaction
      'basic': 0.8,        // 20% penalty for basic interaction
      'adequate': 0.9,     // 10% penalty for adequate interaction
      'thorough': 1.0,     // Full score for thorough interaction
      'extensive': 1.05    // 5% bonus for extensive interaction
    };

    return multipliers[interactionLevel] || 0.6;
  }

  // Evaluate a specific criterion
  async _evaluateCriterion(criterion, session, performanceMetrics) {
    const evaluationMethods = {
      // Clinical skills criteria
      'history_taking_completeness': () => 
        this._evaluateHistoryTaking(session, performanceMetrics),
      'physical_exam_accuracy': () => 
        this._evaluatePhysicalExam(session, performanceMetrics),
      'diagnostic_accuracy': () => 
        this._evaluateDiagnosticAccuracy(performanceMetrics),
      
      // Communication criteria
      'patient_communication': () => 
        this._evaluatePatientCommunication(session, performanceMetrics),
      'team_communication': () => 
        this._evaluateTeamCommunication(performanceMetrics),
      
      // Professionalism criteria
      'time_management': () => 
        this._evaluateTimeManagement(performanceMetrics),
      'safety_protocols': () => 
        this._evaluateSafetyProtocols(performanceMetrics),
      
      // Default evaluation method - more realistic for minimal interaction
      'default': () => 45
    };

    const evaluate = evaluationMethods[criterion.criterionId] || evaluationMethods.default;
    return await evaluate();
  }

  // Specific evaluation methods with realistic scoring
  async _evaluateHistoryTaking(session, performanceMetrics) {
    const metrics = performanceMetrics.dataCollectionMetrics || {};
    const completeness = metrics.completeness || 0;
    const questionsAsked = metrics.questionsAsked || 0;
    const relevantQuestions = metrics.relevantQuestions || 0;

    // Base score from completeness
    let score = completeness * 60; // Max 60% from completeness alone

    // Bonus for asking questions (engagement)
    if (questionsAsked > 0) {
      const questionQuality = relevantQuestions / Math.max(questionsAsked, 1);
      score += Math.min(25, questionQuality * 25); // Up to 25% bonus for good questions
    }

    // Penalty for too few questions (minimal engagement)
    if (questionsAsked < 3) {
      score *= 0.7; // 30% penalty for minimal interaction
    }

    return Math.min(100, Math.max(0, score));
  }

  async _evaluatePhysicalExam(session, performanceMetrics) {
    const metrics = performanceMetrics.clinicalSkillsMetrics || {};
    const accuracy = metrics.physicalExamAccuracy || 0;
    const examCompleteness = metrics.examCompleteness || 0;
    const appropriateExams = metrics.appropriateExams || 0;

    // Base score from accuracy and completeness
    let score = (accuracy * 0.6 + examCompleteness * 0.4) * 70; // Max 70% from basics

    // Bonus for appropriate exam selection
    if (appropriateExams > 0) {
      const examRelevance = appropriateExams / Math.max(metrics.totalExams || 1, 1);
      score += Math.min(20, examRelevance * 20); // Up to 20% bonus for relevance
    }

    // Penalty for missing critical exams
    if (examCompleteness < 0.5) {
      score *= 0.8; // 20% penalty for incomplete exams
    }

    return Math.min(100, Math.max(0, score));
  }

  async _evaluateDiagnosticAccuracy(performanceMetrics) {
    const metrics = performanceMetrics.diagnosticMetrics || {};
    const accuracy = metrics.accuracy || 0;
    const differentialQuality = metrics.differentialQuality || 0;
    const testOrdering = metrics.testOrdering || 0;

    // Base score from diagnostic accuracy
    let score = accuracy * 50; // Max 50% from basic accuracy

    // Add points for differential diagnosis quality
    score += differentialQuality * 25; // Up to 25% for good differential

    // Add points for appropriate test ordering
    score += testOrdering * 15; // Up to 15% for good test selection

    // Penalty for poor diagnostic reasoning
    if (accuracy < 0.3) {
      score *= 0.6; // 40% penalty for poor diagnostic skills
    }

    return Math.min(100, Math.max(0, score));
  }

  async _evaluatePatientCommunication(session, performanceMetrics) {
    const metrics = performanceMetrics.communicationMetrics || {};
    const patientCommunication = metrics.patientCommunication || 0;
    const empathy = metrics.empathy || 0;
    const clarity = metrics.clarity || 0;

    // Base score from communication quality
    let score = patientCommunication * 40; // Max 40% from basic communication

    // Add points for empathy
    score += empathy * 30; // Up to 30% for empathy

    // Add points for clarity
    score += clarity * 20; // Up to 20% for clarity

    // Bonus for comprehensive communication skills
    if (empathy > 0.7 && clarity > 0.7) {
      score += 10; // 10% bonus for excellent communication
    }

    return Math.min(100, Math.max(0, score));
  }

  async _evaluateTeamCommunication(performanceMetrics) {
    const metrics = performanceMetrics.communicationMetrics || {};
    const teamScore = metrics.teamCommunication || 0;
    const consultationRequests = metrics.consultationRequests || 0;
    const handoffQuality = metrics.handoffQuality || 0;

    // Base score from team communication
    let score = teamScore * 50; // Max 50% from basic team communication

    // Add points for appropriate consultations
    if (consultationRequests > 0) {
      score += Math.min(25, consultationRequests * 8); // Up to 25% for consultations
    }

    // Add points for handoff quality
    score += handoffQuality * 15; // Up to 15% for good handoffs

    // Penalty for poor team communication
    if (teamScore < 0.4) {
      score *= 0.7; // 30% penalty for poor teamwork
    }

    return Math.min(100, Math.max(0, score));
  }

  async _evaluateTimeManagement(performanceMetrics) {
    const metrics = performanceMetrics.timeMetrics || {};
    const efficiency = metrics.efficiency || 0;
    const pacing = metrics.pacing || 0;
    const decisionTiming = metrics.decisionTiming || 0;

    // Base score from efficiency
    let score = efficiency * 45; // Max 45% from basic efficiency

    // Add points for good pacing
    score += pacing * 25; // Up to 25% for appropriate pacing

    // Add points for timely decisions
    score += decisionTiming * 20; // Up to 20% for good timing

    // Penalty for poor time management
    if (efficiency < 0.3) {
      score *= 0.6; // 40% penalty for inefficiency
    }

    return Math.min(100, Math.max(0, score));
  }

  async _evaluateSafetyProtocols(performanceMetrics) {
    const metrics = performanceMetrics.safetyMetrics || {};
    const overallScore = metrics.overallScore || 0;
    const protocolAdherence = metrics.protocolAdherence || 0;
    const errorRate = metrics.errorRate || 1;

    // Base score from safety compliance
    let score = overallScore * 40; // Max 40% from basic safety score

    // Add points for protocol adherence
    score += protocolAdherence * 35; // Up to 35% for following protocols

    // Penalty for safety errors
    const errorPenalty = (1 - errorRate) * 20; // Up to 20% penalty for errors
    score -= errorPenalty;

    // Bonus for excellent safety practices
    if (protocolAdherence > 0.8 && errorRate < 0.1) {
      score += 10; // 10% bonus for excellent safety
    }

    return Math.min(100, Math.max(0, score));
  }

  // Integrate AI evaluation with manual scoring (more realistic weighting)
   _integrateAIEvaluation(manualScore, aiEvaluation, interactionLevel) {
     // Adjust AI weight based on interaction level
     let aiWeight, manualWeight;

     switch (interactionLevel) {
       case 'minimal':
         aiWeight = 0.5;    // 50% AI weight for minimal interaction
         manualWeight = 0.5;
         break;
       case 'basic':
         aiWeight = 0.4;    // 40% AI weight for basic interaction
         manualWeight = 0.6;
         break;
       case 'adequate':
         aiWeight = 0.3;    // 30% AI weight for adequate interaction
         manualWeight = 0.7;
         break;
       case 'thorough':
         aiWeight = 0.25;   // 25% AI weight for thorough interaction
         manualWeight = 0.75;
         break;
       case 'extensive':
         aiWeight = 0.2;    // 20% AI weight for extensive interaction
         manualWeight = 0.8;
         break;
       default:
         aiWeight = 0.3;
         manualWeight = 0.7;
     }

     // More realistic AI confidence calculation
     const aiScore = this._calculateRealisticAIScore(aiEvaluation, interactionLevel);

     const integratedScore = Math.round(
       (manualScore * manualWeight) +
       (aiScore * aiWeight)
     );

     return Math.max(0, Math.min(100, integratedScore)); // Clamp between 0-100
   }

   // Calculate more realistic AI evaluation score
   _calculateRealisticAIScore(aiEvaluation, interactionLevel) {
     if (!aiEvaluation || typeof aiEvaluation.confidenceScore !== 'number') {
       return 50; // Default moderate score if AI evaluation unavailable
     }

     const baseScore = aiEvaluation.confidenceScore;

     // Adjust AI score based on interaction level and evaluation quality
     let adjustment = 0;

     // Reduce AI confidence for minimal interaction (AI has less data to work with)
     if (interactionLevel === 'minimal') {
       adjustment = -15;
     } else if (interactionLevel === 'basic') {
       adjustment = -10;
     } else if (interactionLevel === 'extensive') {
       adjustment = 5; // Slight bonus for extensive interaction
     }

     // Consider AI evaluation quality indicators
     if (aiEvaluation.evaluationQuality) {
       const qualityMultiplier = aiEvaluation.evaluationQuality;
       adjustment += (qualityMultiplier - 0.5) * 10; // -5 to +5 based on quality
     }

     const adjustedScore = baseScore + adjustment;
     return Math.max(30, Math.min(90, adjustedScore)); // Clamp AI scores between 30-90
   }

  // Update competency assessment with scoring results
  async _updateCompetencyAssessment(userId, scoringResult, rubric) {
    try {
      let assessment = await CompetencyAssessment.findOne({ userId });
      if (!assessment) {
        // Initialize assessment if it doesn't exist
        const CompetencyAssessmentService = await import('./CompetencyAssessmentService.js');
        assessment = await CompetencyAssessmentService.default.initializeUserAssessment(userId);
      }

      // Map rubric areas to competencies
      for (const area of rubric.competencyAreas) {
        const areaScore = scoringResult.criteriaScores
          .filter(c => c.area === area.area)
          .reduce((sum, c) => sum + (c.score * c.weight), 0) / 
          scoringResult.criteriaScores.filter(c => c.area === area.area).reduce((sum, c) => sum + c.weight, 0);

        if (areaScore) {
          await this._updateCompetency(assessment, area.area, areaScore);
        }
      }

      await assessment.save();
    } catch (error) {
      logger.warn({ userId, error: error.message }, 'Failed to update competency assessment');
    }
  }

  async _updateCompetency(assessment, area, score) {
    const competency = assessment.competencies.find(comp => 
      comp.area === area || comp.competencyName.toLowerCase().includes(area.toLowerCase())
    );
    
    if (competency) {
      competency.confidenceScore = Math.max(competency.confidenceScore, score);
      competency.lastAssessed = new Date();
    }
  }

  _getUnifiedRubric() {
    return {
      rubricId: 'UNIFIED-RUBRIC-2024',
      name: 'Unified Scoring Rubric 2024',
      description: 'Comprehensive scoring rubric for all case simulations',
      competencyAreas: [
        {
          area: 'clinical_skills',
          weight: 0.4,
          criteria: [
            {
              criterionId: 'history_taking_completeness',
              description: 'Completeness and accuracy of history taking',
              maxScore: 100,
              weight: 0.3,
              evaluationGuidelines: 'Assess thoroughness of patient history, including chief complaint, HPI, PMH, etc.',
              evidenceRequirements: ['case_narrative', 'documentation']
            },
            {
              criterionId: 'physical_exam_accuracy',
              description: 'Accuracy of physical examination findings',
              maxScore: 100,
              weight: 0.3,
              evaluationGuidelines: 'Evaluate appropriate physical exam techniques and accurate interpretation',
              evidenceRequirements: ['exam_documentation', 'findings']
            },
            {
              criterionId: 'diagnostic_accuracy',
              description: 'Accuracy of diagnostic reasoning',
              maxScore: 100,
              weight: 0.4,
              evaluationGuidelines: 'Assess appropriate differential diagnosis and diagnostic test selection',
              evidenceRequirements: ['differential_diagnosis', 'test_ordering']
            }
          ]
        },
        {
          area: 'communication',
          weight: 0.3,
          criteria: [
            {
              criterionId: 'patient_communication',
              description: 'Effectiveness of patient communication',
              maxScore: 100,
              weight: 0.6,
              evaluationGuidelines: 'Evaluate empathy, clarity, and patient-centered communication',
              evidenceRequirements: ['patient_interactions', 'communication_quality']
            },
            {
              criterionId: 'team_communication',
              description: 'Effectiveness of team communication',
              maxScore: 100,
              weight: 0.4,
              evaluationGuidelines: 'Assess clarity and appropriateness of team communication',
              evidenceRequirements: ['team_interactions', 'consultation_requests']
            }
          ]
        },
        {
          area: 'professionalism',
          weight: 0.3,
          criteria: [
            {
              criterionId: 'time_management',
              description: 'Efficiency in time management',
              maxScore: 100,
              weight: 0.5,
              evaluationGuidelines: 'Evaluate appropriate pacing and time utilization',
              evidenceRequirements: ['time_metrics', 'decision_timing']
            },
            {
              criterionId: 'safety_protocols',
              description: 'Adherence to safety protocols',
              maxScore: 100,
              weight: 0.5,
              evaluationGuidelines: 'Assess compliance with patient safety and infection control protocols',
              evidenceRequirements: ['safety_checks', 'protocol_adherence']
            }
          ]
        }
      ],
      passingScore: 70,
      determinePerformanceLevel: function(score, interactionLevel = 'minimal') {
        // Adjust performance level thresholds based on interaction level
        const thresholds = {
          'minimal': { expert: 85, proficient: 75, competent: 60, advanced_beginner: 45 },
          'basic': { expert: 88, proficient: 78, competent: 65, advanced_beginner: 50 },
          'adequate': { expert: 90, proficient: 80, competent: 70, advanced_beginner: 55 },
          'thorough': { expert: 92, proficient: 82, competent: 72, advanced_beginner: 60 },
          'extensive': { expert: 95, proficient: 85, competent: 75, advanced_beginner: 65 }
        };

        const levelThresholds = thresholds[interactionLevel] || thresholds.minimal;

        if (score >= levelThresholds.expert) return 'expert';
        if (score >= levelThresholds.proficient) return 'proficient';
        if (score >= levelThresholds.competent) return 'competent';
        if (score >= levelThresholds.advanced_beginner) return 'advanced_beginner';
        return 'novice';
      },
      calculateScore: function(criteriaScores) {
        let totalScore = 0;
        let totalWeight = 0;

        this.competencyAreas.forEach(area => {
          const areaCriteriaScores = criteriaScores.filter(score =>
            score.area === area.area
          );

          let areaScore = 0;
          let areaWeight = 0;

          area.criteria.forEach(criterion => {
            const criterionScore = areaCriteriaScores.find(s => s.criterionId === criterion.criterionId);
            if (criterionScore) {
              // Use adjusted score if available, otherwise fall back to base score
              const scoreToUse = criterionScore.adjustedScore !== undefined ?
                criterionScore.adjustedScore : criterionScore.score;
              areaScore += (scoreToUse / criterion.maxScore) * criterion.weight;
              areaWeight += criterion.weight;
            }
          });

          if (areaWeight > 0) {
            totalScore += (areaScore / areaWeight) * area.weight;
            totalWeight += area.weight;
          }
        });

        const finalScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

        // Apply minimum score thresholds based on interaction level
        const interactionLevel = criteriaScores.length > 0 ? criteriaScores[0].interactionLevel : 'minimal';
        const minThresholds = {
          'minimal': 20,      // Minimum 20% for minimal interaction
          'basic': 30,        // Minimum 30% for basic interaction
          'adequate': 40,     // Minimum 40% for adequate interaction
          'thorough': 50,     // Minimum 50% for thorough interaction
          'extensive': 60     // Minimum 60% for extensive interaction
        };

        const minScore = minThresholds[interactionLevel] || 20;
        return Math.max(minScore, finalScore);
      }
    };
  }

  // Get scoring statistics and analytics
  async getScoringAnalytics(rubricId, timeframe = '30d') {
    try {
      const startDate = this._calculateStartDate(timeframe);
      
      const sessions = await SessionModel.find({
        'scoringResults.rubricId': rubricId,
        'scoringResults.evaluatedAt': { $gte: startDate }
      });

      const scores = sessions.map(s => s.scoringResults.finalScore).filter(score => score !== undefined);
      
      if (scores.length === 0) {
        return { message: 'No scoring data available for the specified timeframe' };
      }

      return {
        totalAssessments: scores.length,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
        passingRate: Math.round((scores.filter(s => s >= 70).length / scores.length) * 100),
        scoreDistribution: this._calculateScoreDistribution(scores),
        timeframe
      };
    } catch (error) {
      logger.error({ rubricId, error: error.message }, 'Error getting scoring analytics');
      throw error;
    }
  }

  _calculateStartDate(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '7d': return new Date(now.setDate(now.getDate() - 7));
      case '30d': return new Date(now.setDate(now.getDate() - 30));
      case '90d': return new Date(now.setDate(now.getDate() - 90));
      case '1y': return new Date(now.setFullYear(now.getFullYear() - 1));
      default: return new Date(now.setDate(now.getDate() - 30));
    }
  }

  _calculateScoreDistribution(scores) {
    const distribution = {
      '0-59': 0,
      '60-69': 0,
      '70-79': 0,
      '80-89': 0,
      '90-100': 0
    };

    scores.forEach(score => {
      if (score < 60) distribution['0-59']++;
      else if (score < 70) distribution['60-69']++;
      else if (score < 80) distribution['70-79']++;
      else if (score < 90) distribution['80-89']++;
      else distribution['90-100']++;
    });

    return distribution;
  }
}

export default new ScoringService();
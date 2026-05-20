import Session from '../models/SessionModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';
import { getEvaluation } from './aiService.js';

class RetakeService {
  // Identify improvement areas based on previous session performance
  async identifyImprovementAreas(previousSessionId) {
    try {
      const previousSession = await Session.findById(previousSessionId)
        .populate('evaluation_ref');
      
      if (!previousSession || !previousSession.evaluation_ref) {
        throw new Error('Previous session or evaluation not found');
      }

      const evaluation = previousSession.evaluation_ref;
      const improvementAreas = [];

      // Analyze individual performance metrics for areas needing improvement
      const metricsToAnalyze = [
        { key: 'history_taking_rating', name: 'History Taking', threshold: 'Good' },
        { key: 'risk_factor_assessment_rating', name: 'Risk Assessment', threshold: 'Good' },
        { key: 'differential_diagnosis_questioning_rating', name: 'Differential Diagnosis', threshold: 'Good' },
        { key: 'communication_and_empathy_rating', name: 'Communication & Empathy', threshold: 'Good' },
        { key: 'clinical_urgency_rating', name: 'Clinical Urgency', threshold: 'Good' },
        { key: 'overall_diagnosis_accuracy', name: 'Diagnosis Accuracy', threshold: 'Reached' }
      ];

      for (const metric of metricsToAnalyze) {
        const rating = evaluation.metrics[metric.key];
        if (rating && this.isBelowThreshold(rating, metric.threshold)) {
          improvementAreas.push({
            area: metric.name,
            currentRating: rating,
            targetRating: metric.threshold,
            severity: this.calculateSeverity(rating, metric.threshold)
          });
        }
      }

      // Add overall score analysis
      const overallScore = evaluation.metrics.overall_score || 0;
      if (overallScore < 70) {
        improvementAreas.push({
          area: 'Overall Performance',
          currentScore: overallScore,
          targetScore: 85,
          severity: 'high'
        });
      }

      return improvementAreas.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
    } catch (error) {
      console.error('Error identifying improvement areas:', error);
      throw new Error(`Failed to identify improvement areas: ${error.message}`);
    }
  }

  // Generate adaptive hints based on improvement areas and case context
  async generateAdaptiveHints(improvementAreas, caseId, attemptNumber) {
    try {
      const caseDoc = await Case.findById(caseId);
      if (!caseDoc) {
        throw new Error('Case not found');
      }

      const hints = [];
      const caseContext = {
        specialty: caseDoc.case_metadata.specialty,
        difficulty: caseDoc.case_metadata.difficulty,
        chiefComplaint: caseDoc.patient_persona.chief_complaint
      };

      // Generate hints based on improvement areas
      for (const area of improvementAreas.slice(0, 3)) { // Focus on top 3 areas
        const hint = this.createHintForArea(area, caseContext, attemptNumber);
        if (hint) {
          hints.push(hint);
        }
      }

      // Add general progression hints based on attempt number
      if (attemptNumber > 1) {
        hints.push({
          type: 'progression',
          title: 'Learning from Experience',
          content: `This is your ${this.getOrdinal(attemptNumber)} attempt. Focus on implementing the feedback from your previous session.`,
          priority: 'medium'
        });
      }

      return hints;
    } catch (error) {
      console.error('Error generating adaptive hints:', error);
      throw new Error(`Failed to generate adaptive hints: ${error.message}`);
    }
  }

  // Compare performance between multiple attempts
  async compareAttempts(caseId, userId) {
    try {
      const sessions = await Session.find({
        user: userId,
        case_ref: caseId,
        sessionEnded: true
      })
      .populate('evaluation_ref')
      .sort({ retake_attempt_number: 1 });

      if (sessions.length < 2) {
        throw new Error('Need at least 2 completed sessions for comparison');
      }

      const comparison = {
        totalAttempts: sessions.length,
        scoreProgression: [],
        areaImprovements: [],
        overallTrend: 'stable'
      };

      // Track score progression
      sessions.forEach((session, index) => {
        if (session.evaluation_ref) {
          comparison.scoreProgression.push({
            attempt: session.retake_attempt_number,
            score: session.evaluation_ref.metrics.overall_score || 0,
            timestamp: session.updatedAt
          });
        }
      });

      // Calculate area improvements between first and last attempt
      const firstSession = sessions[0];
      const lastSession = sessions[sessions.length - 1];

      if (firstSession.evaluation_ref && lastSession.evaluation_ref) {
        const metricsToCompare = [
          'history_taking_rating',
          'risk_factor_assessment_rating',
          'differential_diagnosis_questioning_rating',
          'communication_and_empathy_rating',
          'clinical_urgency_rating'
        ];

        for (const metric of metricsToCompare) {
          const firstRating = firstSession.evaluation_ref.metrics[metric];
          const lastRating = lastSession.evaluation_ref.metrics[metric];

          if (firstRating && lastRating) {
            const improvement = this.calculateRatingImprovement(firstRating, lastRating);
            if (improvement !== 0) {
              comparison.areaImprovements.push({
                area: metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                firstAttempt: firstRating,
                lastAttempt: lastRating,
                improvement: improvement
              });
            }
          }
        }
      }

      // Determine overall trend
      if (comparison.scoreProgression.length >= 2) {
        const firstScore = comparison.scoreProgression[0].score;
        const lastScore = comparison.scoreProgression[comparison.scoreProgression.length - 1].score;
        
        if (lastScore > firstScore + 10) {
          comparison.overallTrend = 'improving';
        } else if (lastScore < firstScore - 10) {
          comparison.overallTrend = 'declining';
        }
      }

      return comparison;
    } catch (error) {
      console.error('Error comparing attempts:', error);
      throw new Error(`Failed to compare attempts: ${error.message}`);
    }
  }

  // Generate personalized learning recommendations
  async generateLearningRecommendations(userId, caseId, improvementAreas) {
    try {
      const recommendations = [];
      const caseDoc = await Case.findById(caseId);
      
      if (!caseDoc) {
        throw new Error('Case not found');
      }

      const caseContext = {
        specialty: caseDoc.case_metadata.specialty,
        difficulty: caseDoc.case_metadata.difficulty
      };

      // Generate recommendations based on improvement areas
      for (const area of improvementAreas.slice(0, 3)) {
        const recommendation = this.createRecommendationForArea(area, caseContext);
        recommendations.push(recommendation);
      }

      // Add case-specific recommendations
      recommendations.push({
        type: 'case_specific',
        title: 'Case Mastery',
        content: `Focus on understanding the ${caseContext.specialty} aspects of this case. Review similar cases to build expertise.`,
        priority: 'medium'
      });

      return recommendations;
    } catch (error) {
      console.error('Error generating learning recommendations:', error);
      throw new Error(`Failed to generate learning recommendations: ${error.message}`);
    }
  }

  // Helper methods
  isBelowThreshold(rating, threshold) {
    const ratingHierarchy = {
      'Excellent': 5,
      'Very Good': 4,
      'Good': 3,
      'Fair': 2,
      'Poor': 1,
      'Not Assessed': 0,
      'Reached': 3,
      'Partially Reached': 2,
      'Missed': 1,
      'Undetermined': 0
    };

    return ratingHierarchy[rating] < ratingHierarchy[threshold];
  }

  calculateSeverity(rating, threshold) {
    const ratingHierarchy = {
      'Excellent': 5,
      'Very Good': 4,
      'Good': 3,
      'Fair': 2,
      'Poor': 1,
      'Not Assessed': 0,
      'Reached': 3,
      'Partially Reached': 2,
      'Missed': 1,
      'Undetermined': 0
    };

    const difference = ratingHierarchy[threshold] - ratingHierarchy[rating];
    if (difference >= 2) return 'high';
    if (difference === 1) return 'medium';
    return 'low';
  }

  getSeverityWeight(severity) {
    const weights = { high: 3, medium: 2, low: 1 };
    return weights[severity] || 1;
  }

  createHintForArea(area, caseContext, attemptNumber) {
    const hintsLibrary = {
      'History Taking': {
        high: `Focus on thorough history taking. Ask about onset, duration, and associated symptoms for ${caseContext.chiefComplaint}.`,
        medium: `Improve your history taking by exploring the patient's medical history and social factors.`,
        low: `Maintain your good history taking skills while focusing on other areas.`
      },
      'Risk Assessment': {
        high: `Pay close attention to risk factors. Consider the patient's age, comorbidities, and lifestyle factors.`,
        medium: `Enhance your risk assessment by considering both immediate and long-term risks.`,
        low: `Your risk assessment is good; now focus on integrating it with other clinical decisions.`
      },
      'Differential Diagnosis': {
        high: `Broaden your differential diagnosis. Consider both common and rare causes of ${caseContext.chiefComplaint}.`,
        medium: `Refine your differential diagnosis by prioritizing based on probability and urgency.`,
        low: `Your diagnostic thinking is strong; focus on efficient diagnostic testing strategies.`
      },
      'Communication & Empathy': {
        high: `Work on building rapport with the patient. Use empathetic language and active listening.`,
        medium: `Enhance your communication by ensuring the patient understands the diagnosis and treatment plan.`,
        low: `Your communication skills are good; focus on tailoring your approach to this specific patient.`
      },
      'Clinical Urgency': {
        high: `Improve your recognition of clinical urgency. Triage symptoms based on severity and time-sensitivity.`,
        medium: `Refine your urgency assessment by considering both objective findings and patient concerns.`,
        low: `Your clinical urgency assessment is appropriate; maintain this standard.`
      },
      'Diagnosis Accuracy': {
        high: `Focus on accurate diagnosis. Review the key findings and ensure they support your conclusion.`,
        medium: `Improve diagnostic accuracy by considering alternative explanations and confounding factors.`,
        low: `Your diagnostic accuracy is good; focus on comprehensive management planning.`
      },
      'Overall Performance': {
        high: `Focus on comprehensive clinical reasoning. Take your time to consider all aspects of the case.`,
        medium: `Work on integrating all clinical skills for a more holistic approach.`,
        low: `You're performing well; focus on maintaining consistency across all case aspects.`
      }
    };

    const hintTemplate = hintsLibrary[area.area]?.[area.severity];
    if (!hintTemplate) return null;

    return {
      type: 'adaptive',
      area: area.area,
      content: hintTemplate,
      severity: area.severity,
      priority: this.getSeverityWeight(area.severity)
    };
  }

  createRecommendationForArea(area, caseContext) {
    const recommendations = {
      'History Taking': `Practice focused history taking for ${caseContext.specialty} cases. Consider using the OLDCARTS framework (Onset, Location, Duration, Character, Aggravating/Relieving factors, Timing, Severity).`,
      'Risk Assessment': `Study common risk factors in ${caseContext.specialty}. Review guidelines for risk stratification and preventive measures.`,
      'Differential Diagnosis': `Build your differential diagnosis skills for ${caseContext.specialty} presentations. Create mental checklists for common symptoms.`,
      'Communication & Empathy': `Practice patient-centered communication. Role-play difficult conversations and work on delivering bad news effectively.`,
      'Clinical Urgency': `Develop better triage skills. Learn to recognize red flags and time-sensitive conditions in ${caseContext.specialty}.`,
      'Diagnosis Accuracy': `Improve diagnostic accuracy through pattern recognition and clinical reasoning exercises. Review classic case presentations.`,
      'Overall Performance': `Engage in deliberate practice with varied case difficulties. Focus on integrating all clinical skills seamlessly.`
    };

    return {
      area: area.area,
      recommendation: recommendations[area.area] || `Focus on improving your ${area.area} skills through practice and study.`,
      resources: this.getLearningResources(area.area, caseContext.specialty),
      timeframe: '1-2 weeks',
      priority: area.severity
    };
  }

  getLearningResources(area, specialty) {
    const resources = {
      'History Taking': [
        'Clinical Interviewing Techniques textbook',
        'Communication skills workshops',
        'Standardized patient practice sessions'
      ],
      'Risk Assessment': [
        `${specialty} risk assessment guidelines`,
        'Clinical prediction rules',
        'Evidence-based medicine resources'
      ],
      'Differential Diagnosis': [
        'Differential diagnosis mnemonics',
        'Specialty-specific decision trees',
        'Case-based learning modules'
      ],
      'Communication & Empathy': [
        'Patient communication simulations',
        'Cultural competency training',
        'Empathy building exercises'
      ],
      'Clinical Urgency': [
        'Emergency medicine protocols',
        'Triage training materials',
        'Time-sensitive condition guidelines'
      ],
      'Diagnosis Accuracy': [
        'Diagnostic reasoning courses',
        'Pattern recognition exercises',
        'Clinical pearl collections'
      ],
      'Overall Performance': [
        'Integrated clinical skills training',
        'Simulation-based education',
        'Mentorship and feedback sessions'
      ]
    };

    return resources[area] || ['General clinical skills improvement resources'];
  }

  calculateRatingImprovement(firstRating, lastRating) {
    const ratingValues = {
      'Excellent': 5,
      'Very Good': 4,
      'Good': 3,
      'Fair': 2,
      'Poor': 1,
      'Not Assessed': 0,
      'Reached': 3,
      'Partially Reached': 2,
      'Missed': 1,
      'Undetermined': 0
    };

    return ratingValues[lastRating] - ratingValues[firstRating];
  }

  getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
}

export default new RetakeService();
import mongoose from 'mongoose';
import { getEvaluation } from './aiService.js';
import Case from '../models/CaseModel.js';
import Session from '../models/SessionModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import auditLogger from './AuditLoggerService.js';

/**
 * Pharmacy Simulation Service
 * Handles pharmacy-specific case simulation for medication therapy management,
 * drug interaction checking, patient counseling, and outcome tracking
 */
class PharmacySimulationService {
  constructor() {
    this.pharmacyActions = new Map([
      ['medication_review', this.processMedicationReview.bind(this)],
      ['therapy_optimization', this.processTherapyOptimization.bind(this)],
      ['drug_interaction_check', this.processDrugInteractionCheck.bind(this)],
      ['allergy_check', this.processAllergyCheck.bind(this)],
      ['patient_counseling', this.processPatientCounseling.bind(this)],
      ['monitoring_parameters', this.processMonitoringParameters.bind(this)],
      ['outcome_tracking', this.processOutcomeTracking.bind(this)],
      ['medication_reconciliation', this.processMedicationReconciliation.bind(this)]
    ]);
  }

  /**
   * Process pharmacy-specific action
   * @param {Object} sessionState - Current session state
   * @param {Object} action - User action
   * @returns {Promise<Object>} - System response
   */
  async processPharmacyAction(sessionState, action) {
    const actionHandler = this.pharmacyActions.get(action.type);
    if (!actionHandler) {
      throw new Error(`Unknown pharmacy action type: ${action.type}`);
    }

    return await actionHandler(sessionState, action.data);
  }

  /**
   * Process medication review and therapy assessment
   */
  async processMedicationReview(sessionState, data) {
    const { medication_list, clinical_condition, patient_factors } = data;
    const dossier = sessionState.clinicalDossier;
    const medicationTherapy = dossier.medication_therapy;

    // Simulate medication review
    let reviewFindings = [];
    let therapyIssues = [];
    let optimizationOpportunities = [];

    // Check for appropriateness based on clinical condition
    if (medicationTherapy?.appropriate_indications) {
      medication_list?.forEach(med => {
        const isAppropriate = medicationTherapy.appropriate_indications.some(indication =>
          indication.medication === med.name && indication.condition === clinical_condition
        );
        
        if (!isAppropriate) {
          therapyIssues.push(`Inappropriate medication: ${med.name} for ${clinical_condition}`);
        }
      });
    }

    // Check dosage appropriateness
    if (medicationTherapy?.standard_dosages) {
      medication_list?.forEach(med => {
        const standardDose = medicationTherapy.standard_dosages.find(d => d.medication === med.name);
        if (standardDose && med.dose !== standardDose.dose) {
          therapyIssues.push(`Dosage deviation: ${med.name} - expected ${standardDose.dose}, got ${med.dose}`);
        }
      });
    }

    // Check for drug-disease interactions
    if (patient_factors?.comorbidities && medicationTherapy?.drug_disease_interactions) {
      patient_factors.comorbidities.forEach(comorbidity => {
        medication_list?.forEach(med => {
          const interaction = medicationTherapy.drug_disease_interactions.find(
            i => i.medication === med.name && i.condition === comorbidity
          );
          if (interaction) {
            therapyIssues.push(`Drug-disease interaction: ${med.name} may exacerbate ${comorbidity}`);
          }
        });
      });
    }

    reviewFindings.push({
      medications_reviewed: medication_list?.length || 0,
      therapy_issues: therapyIssues,
      optimization_opportunities: optimizationOpportunities.length > 0 ? optimizationOpportunities : ['Therapy appears appropriate'],
      timestamp: new Date()
    });

    return {
      type: 'medication_review',
      data: {
        clinical_condition,
        review_findings: reviewFindings,
        therapy_issues: therapyIssues.length > 0 ? therapyIssues : ['No therapy issues identified'],
        recommendations: [
          'Consider therapeutic alternatives if issues present',
          'Monitor patient response to therapy',
          'Document review findings in patient record'
        ]
      }
    };
  }

  /**
   * Process therapy optimization recommendations
   */
  async processTherapyOptimization(sessionState, data) {
    const { current_therapy, optimization_goals, patient_preferences } = data;
    const dossier = sessionState.clinicalDossier;
    const therapyOptions = dossier.therapy_options;

    // Simulate therapy optimization
    let optimizationRecommendations = [];
    let evidenceSupport = [];
    let costConsiderations = [];

    // Generate optimization recommendations based on goals
    if (therapyOptions?.alternative_therapies) {
      therapyOptions.alternative_therapies.forEach(alternative => {
        if (optimization_goals.includes(alternative.benefit)) {
          optimizationRecommendations.push({
            therapy: alternative.medication,
            rationale: alternative.rationale,
            expected_benefit: alternative.benefit,
            evidence_level: alternative.evidence_level || 'Moderate'
          });
        }
      });
    }

    // Consider patient preferences
    if (patient_preferences) {
      optimizationRecommendations = optimizationRecommendations.filter(rec =>
        !patient_preferences.contraindications?.includes(rec.therapy)
      );
    }

    // Add cost considerations
    if (therapyOptions?.cost_comparison) {
      costConsiderations = therapyOptions.cost_comparison.map(cost => ({
        medication: cost.medication,
        cost: cost.cost,
        insurance_coverage: cost.coverage
      }));
    }

    return {
      type: 'therapy_optimization',
      data: {
        optimization_recommendations: optimizationRecommendations,
        evidence_support: evidenceSupport,
        cost_considerations: costConsiderations,
        implementation_steps: [
          'Discuss options with prescriber',
          'Consider patient-specific factors',
          'Develop monitoring plan',
          'Document optimization rationale'
        ]
      }
    };
  }

  /**
   * Process drug interaction checking
   */
  async processDrugInteractionCheck(sessionState, data) {
    const { medication_list, existing_medications } = data;
    const dossier = sessionState.clinicalDossier;
    const drugInteractions = dossier.drug_interactions;

    // Simulate drug interaction checking
    let interactionFindings = [];
    let severityLevels = [];
    let managementRecommendations = [];

    // Check for interactions between new and existing medications
    medication_list?.forEach(newMed => {
      existing_medications?.forEach(existingMed => {
        const interaction = drugInteractions?.find(i =>
          (i.medication1 === newMed.name && i.medication2 === existingMed.name) ||
          (i.medication1 === existingMed.name && i.medication2 === newMed.name)
        );

        if (interaction) {
          interactionFindings.push({
            medications: `${newMed.name} and ${existingMed.name}`,
            interaction_type: interaction.type,
            severity: interaction.severity,
            mechanism: interaction.mechanism,
            clinical_effects: interaction.effects
          });

          severityLevels.push(interaction.severity);

          if (interaction.management) {
            managementRecommendations.push({
              interaction: `${newMed.name} - ${existingMed.name}`,
              recommendations: interaction.management
            });
          }
        }
      });
    });

    // Check for interactions within new medications
    for (let i = 0; i < medication_list?.length; i++) {
      for (let j = i + 1; j < medication_list?.length; j++) {
        const med1 = medication_list[i];
        const med2 = medication_list[j];
        const interaction = drugInteractions?.find(i =>
          (i.medication1 === med1.name && i.medication2 === med2.name) ||
          (i.medication1 === med2.name && i.medication2 === med1.name)
        );

        if (interaction) {
          interactionFindings.push({
            medications: `${med1.name} and ${med2.name}`,
            interaction_type: interaction.type,
            severity: interaction.severity,
            mechanism: interaction.mechanism,
            clinical_effects: interaction.effects
          });

          severityLevels.push(interaction.severity);

          if (interaction.management) {
            managementRecommendations.push({
              interaction: `${med1.name} - ${med2.name}`,
              recommendations: interaction.management
            });
          }
        }
      }
    }

    const overallSeverity = severityLevels.length > 0 ? 
      Math.max(...severityLevels.map(s => this.severityToNumber(s))) : 'None';

    return {
      type: 'drug_interaction_check',
      data: {
        interaction_findings: interactionFindings,
        overall_severity: this.numberToSeverity(overallSeverity),
        management_recommendations: managementRecommendations,
        monitoring_requirements: [
          'Monitor for signs of interaction effects',
          'Consider therapeutic drug monitoring if available',
          'Assess patient response regularly'
        ]
      }
    };
  }

  /**
   * Process allergy checking
   */
  async processAllergyCheck(sessionState, data) {
    const { medication_list, patient_allergies } = data;
    const dossier = sessionState.clinicalDossier;
    const crossReactivity = dossier.allergy_cross_reactivity;

    // Simulate allergy checking
    let allergyFindings = [];
    let crossReactivityWarnings = [];
    let alternativeSuggestions = [];

    // Check direct allergies
    medication_list?.forEach(med => {
      if (patient_allergies?.some(allergy => 
        allergy.toLowerCase().includes(med.name.toLowerCase()) ||
        med.name.toLowerCase().includes(allergy.toLowerCase())
      )) {
        allergyFindings.push({
          medication: med.name,
          allergy_match: 'Direct match',
          severity: 'High',
          recommendation: 'Avoid medication - direct allergy'
        });
      }
    });

    // Check cross-reactivity
    if (crossReactivity) {
      medication_list?.forEach(med => {
        patient_allergies?.forEach(allergy => {
          const reactivity = crossReactivity.find(cr =>
            cr.allergen.toLowerCase() === allergy.toLowerCase() &&
            cr.cross_reactive_meds.includes(med.name)
          );

          if (reactivity) {
            crossReactivityWarnings.push({
              medication: med.name,
              known_allergy: allergy,
              cross_reactivity_risk: reactivity.risk_level,
              recommendation: reactivity.recommendation
            });
          }
        });
      });
    }

    // Suggest alternatives for allergic medications
    allergyFindings.forEach(finding => {
      const alternatives = this.suggestAlternativeMedications(finding.medication, dossier);
      if (alternatives.length > 0) {
        alternativeSuggestions.push({
          allergic_med: finding.medication,
          alternatives: alternatives
        });
      }
    });

    crossReactivityWarnings.forEach(warning => {
      const alternatives = this.suggestAlternativeMedications(warning.medication, dossier);
      if (alternatives.length > 0) {
        alternativeSuggestions.push({
          allergic_med: warning.medication,
          alternatives: alternatives
        });
      }
    });

    return {
      type: 'allergy_check',
      data: {
        allergy_findings: allergyFindings,
        cross_reactivity_warnings: crossReactivityWarnings,
        alternative_suggestions: alternativeSuggestions,
        safety_recommendations: [
          'Document allergy findings in patient record',
          'Communicate risks to prescriber and patient',
          'Consider desensitization protocol if medically necessary'
        ]
      }
    };
  }

  /**
   * Process patient counseling scenarios
   */
  async processPatientCounseling(sessionState, data) {
    const { medication, counseling_topics, patient_understanding } = data;
    const dossier = sessionState.clinicalDossier;
    const counselingGuidelines = dossier.patient_counseling;

    // Simulate patient counseling
    let counselingPoints = [];
    let assessmentResults = [];
    let followUpNeeds = [];

    // Generate counseling points based on medication and topics
    if (counselingGuidelines?.medication_counseling) {
      counselingGuidelines.medication_counseling.forEach(guideline => {
        if (guideline.medication === medication) {
          counseling_topics?.forEach(topic => {
            const topicInfo = guideline.topics.find(t => t.topic === topic);
            if (topicInfo) {
              counselingPoints.push({
                topic: topic,
                key_points: topicInfo.key_points,
                visual_aids: topicInfo.visual_aids || [],
                teach_back_questions: topicInfo.teach_back_questions || []
              });
            }
          });
        }
      });
    }

    // Assess patient understanding
    if (patient_understanding) {
      assessmentResults = this.assessPatientUnderstanding(patient_understanding, counselingPoints);
      
      // Identify follow-up needs based on assessment
      if (assessmentResults.some(result => result.understanding_level === 'Poor')) {
        followUpNeeds.push('Additional counseling session needed');
        followUpNeeds.push('Simplified educational materials required');
      }
    }

    return {
      type: 'patient_counseling',
      data: {
        medication: medication,
        counseling_points: counselingPoints,
        assessment_results: assessmentResults,
        follow_up_needs: followUpNeeds,
        documentation_requirements: [
          'Document counseling topics covered',
          'Record patient understanding assessment',
          'Note any follow-up needs',
          'Include teach-back results'
        ]
      }
    };
  }

  /**
   * Process monitoring parameters setup
   */
  async processMonitoringParameters(sessionState, data) {
    const { medication, therapy_duration, patient_factors } = data;
    const dossier = sessionState.clinicalDossier;
    const monitoringGuidelines = dossier.monitoring_parameters;

    // Simulate monitoring parameter setup
    let monitoringPlan = [];
    let frequencyRecommendations = [];
    let safetyAlerts = [];

    // Get monitoring parameters for the medication
    if (monitoringGuidelines?.medication_monitoring) {
      const medicationMonitoring = monitoringGuidelines.medication_monitoring.find(
        m => m.medication === medication
      );

      if (medicationMonitoring) {
        monitoringPlan = medicationMonitoring.parameters.map(param => ({
          parameter: param.parameter,
          baseline: param.baseline_value,
          target_range: param.target_range,
          clinical_significance: param.significance
        }));

        // Adjust frequency based on therapy duration and patient factors
        frequencyRecommendations = this.determineMonitoringFrequency(
          medicationMonitoring, therapy_duration, patient_factors
        );

        // Add safety alerts for high-risk parameters
        safetyAlerts = medicationMonitoring.parameters
          .filter(param => param.risk_level === 'High')
          .map(param => ({
            parameter: param.parameter,
            alert: `High risk parameter: ${param.parameter} - ${param.safety_concerns}`,
            action: param.emergency_action
          }));
      }
    }

    return {
      type: 'monitoring_parameters',
      data: {
        medication: medication,
        monitoring_plan: monitoringPlan,
        frequency_recommendations: frequencyRecommendations,
        safety_alerts: safetyAlerts,
        implementation_guidance: [
          'Establish baseline measurements before therapy initiation',
          'Schedule regular follow-up assessments',
          'Educate patient on self-monitoring if appropriate',
          'Develop action plan for abnormal results'
        ]
      }
    };
  }

  /**
   * Process outcome tracking and assessment
   */
  async processOutcomeTracking(sessionState, data) {
    const { medication, outcomes_measured, time_period } = data;
    const dossier = sessionState.clinicalDossier;
    const outcomeMetrics = dossier.outcome_tracking;

    // Simulate outcome tracking
    let outcomeResults = [];
    let effectivenessAssessment = '';
    let qualityOfLifeImpact = [];
    let economicImpact = [];

    // Track therapeutic outcomes
    if (outcomeMetrics?.therapeutic_outcomes) {
      outcomes_measured?.forEach(outcome => {
        const metric = outcomeMetrics.therapeutic_outcomes.find(
          o => o.medication === medication && o.outcome_type === outcome
        );

        if (metric) {
          const achieved = this.simulateOutcomeAchievement(metric, time_period);
          outcomeResults.push({
            outcome_type: outcome,
            target: metric.target_value,
            achieved: achieved,
            percentage_achieved: (achieved / metric.target_value) * 100,
            clinical_significance: this.assessClinicalSignificance(achieved, metric.target_value)
          });
        }
      });
    }

    // Assess overall effectiveness
    if (outcomeResults.length > 0) {
      const avgAchievement = outcomeResults.reduce((sum, r) => sum + r.percentage_achieved, 0) / outcomeResults.length;
      effectivenessAssessment = avgAchievement >= 80 ? 'Highly effective' :
                               avgAchievement >= 60 ? 'Moderately effective' :
                               'Minimally effective';
    }

    // Assess quality of life impact
    if (outcomeMetrics?.quality_of_life) {
      qualityOfLifeImpact = outcomeMetrics.quality_of_life.map(qol => ({
        domain: qol.domain,
        baseline: qol.baseline_score,
        current: this.simulateQOLImprovement(qol, time_period),
        improvement: ((this.simulateQOLImprovement(qol, time_period) - qol.baseline_score) / qol.baseline_score) * 100
      }));
    }

    // Assess economic impact
    if (outcomeMetrics?.economic_impact) {
      economicImpact = outcomeMetrics.economic_impact.map(econ => ({
        aspect: econ.aspect,
        cost_savings: this.calculateCostSavings(econ, time_period),
        roi: this.calculateROI(econ, time_period)
      }));
    }

    return {
      type: 'outcome_tracking',
      data: {
        medication: medication,
        outcome_results: outcomeResults,
        effectiveness_assessment: effectivenessAssessment,
        quality_of_life_impact: qualityOfLifeImpact,
        economic_impact: economicImpact,
        recommendations: [
          'Continue therapy if outcomes are favorable',
          'Consider therapy adjustment if suboptimal outcomes',
          'Document outcomes for quality improvement',
          'Share results with healthcare team'
        ]
      }
    };
  }

  /**
   * Process medication reconciliation
   */
  async processMedicationReconciliation(sessionState, data) {
    const { current_meds, previous_meds, transition_point } = data;
    const dossier = sessionState.clinicalDossier;

    // Simulate medication reconciliation
    let reconciliationFindings = [];
    let discrepancies = [];
    let resolutionActions = [];

    // Compare current and previous medications
    current_meds?.forEach(currentMed => {
      const previousMed = previous_meds?.find(prev => prev.name === currentMed.name);
      
      if (!previousMed) {
        discrepancies.push({
          type: 'Addition',
          medication: currentMed.name,
          issue: 'New medication without clear indication',
          severity: 'Medium'
        });
      } else if (previousMed.dose !== currentMed.dose) {
        discrepancies.push({
          type: 'Dose change',
          medication: currentMed.name,
          issue: `Dose changed from ${previousMed.dose} to ${currentMed.dose}`,
          severity: 'Low'
        });
      }
    });

    // Check for omissions
    previous_meds?.forEach(previousMed => {
      const currentMed = current_meds?.find(curr => curr.name === previousMed.name);
      if (!currentMed) {
        discrepancies.push({
          type: 'Omission',
          medication: previousMed.name,
          issue: 'Medication discontinued without documentation',
          severity: 'High'
        });
      }
    });

    // Generate resolution actions
    discrepancies.forEach(discrepancy => {
      resolutionActions.push({
        discrepancy: discrepancy,
        action: this.generateResolutionAction(discrepancy, dossier),
        priority: discrepancy.severity
      });
    });

    reconciliationFindings.push({
      medications_reconciled: current_meds?.length || 0,
      discrepancies_found: discrepancies.length,
      transition_point: transition_point,
      timestamp: new Date()
    });

    return {
      type: 'medication_reconciliation',
      data: {
        reconciliation_findings: reconciliationFindings,
        discrepancies: discrepancies,
        resolution_actions: resolutionActions,
        follow_up: [
          'Communicate discrepancies to prescriber',
          'Document reconciliation process',
          'Update medication list in all systems',
          'Educate patient on medication changes'
        ]
      }
    };
  }

  // Helper methods

  severityToNumber(severity) {
    const levels = { 'Low': 1, 'Medium': 2, 'High': 3, 'Severe': 4 };
    return levels[severity] || 0;
  }

  numberToSeverity(number) {
    const levels = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Severe' };
    return levels[number] || 'None';
  }

  suggestAlternativeMedications(medication, dossier) {
    const alternatives = dossier.therapy_options?.alternative_therapies || [];
    return alternatives
      .filter(alt => alt.medication !== medication)
      .map(alt => ({
        medication: alt.medication,
        rationale: alt.rationale,
        evidence: alt.evidence_level
      }));
  }

  assessPatientUnderstanding(understanding, counselingPoints) {
    return counselingPoints.map(point => ({
      topic: point.topic,
      understanding_level: understanding[point.topic] || 'Not assessed',
      follow_up_needed: understanding[point.topic] === 'Poor'
    }));
  }

  determineMonitoringFrequency(monitoring, duration, patientFactors) {
    let baseFrequency = monitoring.base_frequency;
    
    // Adjust for therapy duration
    if (duration === 'Long-term') {
      baseFrequency = this.adjustForLongTerm(baseFrequency);
    }
    
    // Adjust for patient factors
    if (patientFactors?.renal_impairment) {
      baseFrequency = this.increaseFrequency(baseFrequency, 2);
    }
    if (patientFactors?.hepatic_impairment) {
      baseFrequency = this.increaseFrequency(baseFrequency, 1.5);
    }
    if (patientFactors?.age > 65) {
      baseFrequency = this.increaseFrequency(baseFrequency, 1.2);
    }

    return baseFrequency;
  }

  adjustForLongTerm(frequency) {
    // Convert frequency to longer intervals for long-term therapy
    const adjustments = {
      'Daily': 'Weekly',
      'Weekly': 'Monthly',
      'Monthly': 'Quarterly',
      'Quarterly': 'Bi-annually'
    };
    return adjustments[frequency] || frequency;
  }

  increaseFrequency(frequency, multiplier) {
    // Increase frequency based on multiplier
    const frequencies = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];
    const currentIndex = frequencies.indexOf(frequency);
    if (currentIndex > 0) {
      return frequencies[currentIndex - 1];
    }
    return frequency;
  }

  simulateOutcomeAchievement(metric, timePeriod) {
    // Simple simulation of outcome achievement
    const baseAchievement = metric.base_achievement_rate || 0.7;
    const timeFactor = timePeriod === 'Long-term' ? 1.2 : 1.0;
    return metric.target_value * baseAchievement * timeFactor;
  }

  assessClinicalSignificance(achieved, target) {
    const percentage = (achieved / target) * 100;
    if (percentage >= 90) return 'Highly significant';
    if (percentage >= 70) return 'Moderately significant';
    if (percentage >= 50) return 'Minimally significant';
    return 'Not significant';
  }

  simulateQOLImprovement(qolMetric, timePeriod) {
    const improvementRate = qolMetric.improvement_rate || 0.1;
    const timeFactor = timePeriod === 'Long-term' ? 1.5 : 1.0;
    return qolMetric.baseline_score * (1 + improvementRate * timeFactor);
  }

  calculateCostSavings(econMetric, timePeriod) {
    const savingsRate = econMetric.savings_rate || 0.15;
    const timeFactor = timePeriod === 'Long-term' ? 2.0 : 1.0;
    return econMetric.base_cost * savingsRate * timeFactor;
  }

  calculateROI(econMetric, timePeriod) {
    const investment = econMetric.investment_cost || 1000;
    const savings = this.calculateCostSavings(econMetric, timePeriod);
    return (savings - investment) / investment;
  }

  generateResolutionAction(discrepancy, dossier) {
    switch (discrepancy.type) {
      case 'Addition':
        return 'Verify indication and obtain prescription if appropriate';
      case 'Omission':
        return 'Clarify if intentional discontinuation and document reason';
      case 'Dose change':
        return 'Confirm dose change with prescriber and update records';
      default:
        return 'Review with healthcare team and document resolution';
    }
  }

  /**
   * Get pharmacy-specific evaluation criteria
   */
  getPharmacyEvaluationCriteria() {
    return {
      medication_safety: { weight: 0.25, description: 'Appropriate medication selection and safety checks' },
      therapy_optimization: { weight: 0.20, description: 'Therapy optimization and evidence-based practice' },
      patient_education: { weight: 0.15, description: 'Effective patient counseling and education' },
      monitoring_planning: { weight: 0.15, description: 'Appropriate monitoring parameter establishment' },
      outcome_assessment: { weight: 0.15, description: 'Comprehensive outcome tracking and evaluation' },
      documentation: { weight: 0.10, description: 'Accurate and complete documentation' }
    };
  }
}

export default new PharmacySimulationService();
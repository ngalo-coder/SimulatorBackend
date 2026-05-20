import mongoose from 'mongoose';
import { getEvaluation } from './aiService.js';
import Case from '../models/CaseModel.js';
import Session from '../models/SessionModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import auditLogger from './AuditLoggerService.js';

/**
 * Radiology Simulation Service
 * Handles radiology-specific case simulation for imaging interpretation and diagnostic workflows
 */
class RadiologySimulationService {
  constructor() {
    this.radiologyActions = new Map([
      ['study_selection', this.processStudySelection.bind(this)],
      ['imaging_technique', this.processImagingTechnique.bind(this)],
      ['image_interpretation', this.processImageInterpretation.bind(this)],
      ['finding_documentation', this.processFindingDocumentation.bind(this)],
      ['report_generation', this.processReportGeneration.bind(this)],
      ['radiation_safety', this.processRadiationSafety.bind(this)],
      ['critical_finding', this.processCriticalFinding.bind(this)],
      ['consultation_request', this.processConsultationRequest.bind(this)]
    ]);
  }

  /**
   * Process radiology-specific action
   * @param {Object} sessionState - Current session state
   * @param {Object} action - User action
   * @returns {Promise<Object>} - System response
   */
  async processRadiologyAction(sessionState, action) {
    const actionHandler = this.radiologyActions.get(action.type);
    if (!actionHandler) {
      throw new Error(`Unknown radiology action type: ${action.type}`);
    }

    return await actionHandler(sessionState, action.data);
  }

  /**
   * Process imaging study selection
   */
  async processStudySelection(sessionState, data) {
    const { clinical_indication, patient_factors, priority } = data;
    const dossier = sessionState.clinicalDossier;
    const imagingStudy = dossier.imaging_study;

    // Simulate study selection based on clinical indication
    let appropriatenessScore = this.calculateAppropriatenessScore(clinical_indication, imagingStudy.modality);
    let alternativeStudies = this.getAlternativeStudies(clinical_indication, imagingStudy.modality);
    
    let selectionRationale = '';
    let contraindications = [];

    // Check for patient factors that might contraindicate the study
    if (patient_factors?.renal_impairment && imagingStudy.technique?.contrast_used) {
      contraindications.push('Contrast contraindicated due to renal impairment');
      appropriatenessScore = Math.max(0, appropriatenessScore - 30);
    }

    if (patient_factors?.pregnancy && this.isRadiationStudy(imagingStudy.modality)) {
      contraindications.push('Radiation exposure risk in pregnancy');
      appropriatenessScore = Math.max(0, appropriatenessScore - 40);
    }

    selectionRationale = this.generateSelectionRationale(clinical_indication, imagingStudy.modality, appropriatenessScore);

    return {
      type: 'study_selection',
      data: {
        clinical_indication,
        selected_modality: imagingStudy.modality,
        appropriateness_score: appropriatenessScore,
        selection_rationale: selectionRationale,
        contraindications: contraindications.length > 0 ? contraindications : ['No contraindications identified'],
        alternative_studies: alternativeStudies,
        priority_level: priority || 'routine',
        next_steps: ['Proceed with technique selection and optimization']
      }
    };
  }

  /**
   * Process imaging technique selection and optimization
   */
  async processImagingTechnique(sessionState, data) {
    const { protocol_parameters, patient_positioning, contrast_considerations } = data;
    const dossier = sessionState.clinicalDossier;
    const technique = dossier.imaging_study.technique;

    // Simulate technique optimization
    let techniqueAssessment = [];
    let optimizationRecommendations = [];
    let imageQualityFactors = [];

    // Assess protocol parameters
    if (protocol_parameters) {
      techniqueAssessment.push({
        aspect: 'Protocol parameters',
        status: 'optimized',
        details: 'Parameters aligned with standard protocols'
      });
    }

    // Assess patient positioning
    if (patient_positioning && patient_positioning !== technique.patient_positioning) {
      optimizationRecommendations.push(`Consider ${technique.patient_positioning} positioning for better visualization`);
    }

    // Assess contrast considerations
    if (contrast_considerations && technique.contrast_used) {
      const contrastAssessment = this.assessContrastUsage(technique.contrast_type, contrast_considerations);
      techniqueAssessment.push(contrastAssessment);
    }

    // Check image quality factors from dossier
    if (dossier.imaging_study.image_quality) {
      imageQualityFactors = dossier.imaging_study.image_quality.artifacts || [];
      if (dossier.imaging_study.image_quality.limitations) {
        imageQualityFactors.push(...dossier.imaging_study.image_quality.limitations);
      }
    }

    return {
      type: 'imaging_technique',
      data: {
        technique_assessment: techniqueAssessment,
        optimization_recommendations: optimizationRecommendations,
        image_quality_factors: imageQualityFactors,
        acquisition_parameters: technique.acquisition_parameters || {},
        estimated_dose: this.calculateRadiationDose(imagingStudy.modality, technique),
        next_steps: ['Proceed with image acquisition and interpretation']
      }
    };
  }

  /**
   * Process image interpretation and systematic review
   */
  async processImageInterpretation(sessionState, data) {
    const { anatomical_region, findings, measurements } = data;
    const dossier = sessionState.clinicalDossier;
    const systematicReview = dossier.systematic_review;

    // Simulate systematic review findings
    let identifiedFindings = [];
    let normalStructures = [];
    let incidentalFindings = [];

    // Compare user findings with expected findings from dossier
    if (systematicReview.pathological_findings) {
      systematicReview.pathological_findings.forEach(expectedFinding => {
        const userFound = findings?.some(f => 
          f.description?.toLowerCase().includes(expectedFinding.toLowerCase()) ||
          f.location?.toLowerCase().includes(expectedFinding.toLowerCase())
        );

        if (userFound) {
          identifiedFindings.push({
            finding: expectedFinding,
            status: 'correctly_identified',
            confidence: 'high'
          });
        } else {
          identifiedFindings.push({
            finding: expectedFinding,
            status: 'missed',
            confidence: 'requires_review'
          });
        }
      });
    }

    // Check normal structures
    if (systematicReview.normal_structures) {
      normalStructures = systematicReview.normal_structures.map(structure => ({
        structure,
        status: 'normal',
        documented: findings?.some(f => f.description?.toLowerCase().includes(structure.toLowerCase()))
      }));
    }

    // Check incidental findings
    if (systematicReview.incidental_findings) {
      systematicReview.incidental_findings.forEach(incidental => {
        const userFound = findings?.some(f => 
          f.description?.toLowerCase().includes(incidental.toLowerCase())
        );

        if (userFound) {
          incidentalFindings.push({
            finding: incidental,
            status: 'identified',
            clinical_significance: 'requires_correlation'
          });
        }
      });
    }

    return {
      type: 'image_interpretation',
      data: {
        anatomical_region,
        identified_findings: identifiedFindings,
        normal_structures: normalStructures,
        incidental_findings: incidentalFindings,
        measurements: measurements || {},
        interpretation_quality: this.assessInterpretationQuality(identifiedFindings),
        differential_considerations: this.generateDifferentialConsiderations(identifiedFindings),
        next_steps: ['Document findings and generate report']
      }
    };
  }

  /**
   * Process finding documentation and categorization
   */
  async processFindingDocumentation(sessionState, data) {
    const { findings, categorization, urgency_level } = data;
    const dossier = sessionState.clinicalDossier;

    // Simulate finding documentation assessment
    let documentationAssessment = [];
    let categorizationAccuracy = [];
    let communicationRequirements = [];

    // Assess finding documentation completeness
    findings?.forEach(finding => {
      const completeness = this.assessDocumentationCompleteness(finding);
      documentationAssessment.push({
        finding: finding.description,
        completeness_score: completeness.score,
        missing_elements: completeness.missingElements,
        recommendations: completeness.recommendations
      });
    });

    // Assess categorization accuracy
    if (categorization && dossier.imaging_findings) {
      categorizationAccuracy = this.assessCategorizationAccuracy(categorization, dossier.imaging_findings);
    }

    // Determine communication requirements based on urgency
    if (urgency_level === 'critical' || this.hasCriticalFindings(findings)) {
      communicationRequirements = [
        'Immediate communication required',
        'Document time of communication',
        'Use read-back verification',
        'Escalate if unable to reach ordering physician'
      ];
    }

    return {
      type: 'finding_documentation',
      data: {
        documentation_assessment: documentationAssessment,
        categorization_accuracy: categorizationAccuracy,
        communication_requirements: communicationRequirements,
        urgency_level: urgency_level || 'routine',
        reporting_deadline: this.calculateReportingDeadline(urgency_level),
        quality_metrics: {
          completeness: this.calculateCompletenessScore(documentationAssessment),
          accuracy: this.calculateAccuracyScore(categorizationAccuracy),
          timeliness: urgency_level === 'stat' ? 1.0 : 0.8
        }
      }
    };
  }

  /**
   * Process radiology report generation
   */
  async processReportGeneration(sessionState, data) {
    const { report_structure, findings_summary, impressions, recommendations } = data;
    const dossier = sessionState.clinicalDossier;

    // Simulate report quality assessment
    let reportAssessment = [];
    let qualityIssues = [];
    let structuredReport = {};

    // Assess report structure completeness
    const requiredSections = ['clinical_history', 'technique', 'findings', 'impression', 'recommendations'];
    const missingSections = requiredSections.filter(section => !report_structure?.includes(section));
    
    if (missingSections.length > 0) {
      qualityIssues.push(`Missing report sections: ${missingSections.join(', ')}`);
    }

    // Assess findings summary
    if (findings_summary) {
      const findingsAssessment = this.assessFindingsSummary(findings_summary, dossier);
      reportAssessment.push(findingsAssessment);
    }

    // Assess impression quality
    if (impressions) {
      const impressionAssessment = this.assessImpressionQuality(impressions, dossier);
      reportAssessment.push(impressionAssessment);
    }

    // Generate structured report
    structuredReport = {
      clinical_history: dossier.patient_persona?.clinical_history || '',
      technique: dossier.imaging_study?.technique || {},
      comparison: dossier.systematic_review?.comparison_studies || [],
      findings: findings_summary || '',
      impression: impressions || '',
      recommendations: recommendations || []
    };

    return {
      type: 'report_generation',
      data: {
        structured_report: structuredReport,
        report_assessment: reportAssessment,
        quality_issues: qualityIssues,
        communication_status: this.determineCommunicationStatus(dossier),
        next_steps: ['Finalize report and communicate critical findings if applicable']
      }
    };
  }

  /**
   * Process radiation safety considerations
   */
  async processRadiationSafety(sessionState, data) {
    const { dose_optimization, safety_protocols, patient_protection } = data;
    const dossier = sessionState.clinicalDossier;
    const radiationSafety = dossier.radiation_safety;

    // Simulate radiation safety assessment
    let safetyAssessment = [];
    let optimizationOpportunities = [];
    let complianceIssues = [];

    // Assess dose optimization
    if (dose_optimization) {
      const doseAssessment = this.assessDoseOptimization(dose_optimization, radiationSafety);
      safetyAssessment.push(doseAssessment);
      
      if (doseAssessment.optimization_opportunities) {
        optimizationOpportunities.push(...doseAssessment.optimization_opportunities);
      }
    }

    // Assess safety protocol compliance
    if (safety_protocols) {
      const protocolAssessment = this.assessSafetyProtocolCompliance(safety_protocols, radiationSafety);
      safetyAssessment.push(protocolAssessment);
      
      if (protocolAssessment.compliance_issues) {
        complianceIssues.push(...protocolAssessment.compliance_issues);
      }
    }

    // Assess patient protection measures
    if (patient_protection) {
      const protectionAssessment = this.assessPatientProtection(patient_protection, radiationSafety);
      safetyAssessment.push(protectionAssessment);
    }

    return {
      type: 'radiation_safety',
      data: {
        safety_assessment: safetyAssessment,
        optimization_opportunities: optimizationOpportunities,
        compliance_issues: complianceIssues,
        alara_principles: this.getAlaraPrinciples(),
        documentation_requirements: [
          'Dose documentation in RIS/PACS',
          'Protocol optimization notes',
          'Patient safety checklist completion',
          'Quality assurance log entry'
        ],
        next_steps: ['Implement optimization measures and document compliance']
      }
    };
  }

  /**
   * Process critical finding communication
   */
  async processCriticalFinding(sessionState, data) {
    const { finding, severity, communication_method, recipient } = data;
    const dossier = sessionState.clinicalDossier;

    // Simulate critical finding handling
    let communicationProtocol = [];
    let documentationRequirements = [];
    let escalationProcedures = [];

    // Determine communication protocol based on severity
    switch (severity) {
      case 'immediate':
        communicationProtocol = [
          'Direct phone call to ordering physician',
          'Repeat attempt if no answer within 5 minutes',
          'Escalate to department supervisor if unable to reach',
          'Document all communication attempts'
        ];
        escalationProcedures = [
          'Contact hospital administrator',
          'Notify risk management',
          'Initiate critical value protocol'
        ];
        break;
      case 'urgent':
        communicationProtocol = [
          'Phone call within 30 minutes',
          'Document time of communication',
          'Use read-back verification',
          'Follow-up with written report'
        ];
        break;
      default:
        communicationProtocol = [
          'Include in routine report',
          'Highlight in impression section',
          'Routine follow-up recommended'
        ];
    }

    documentationRequirements = [
      'Critical finding report form',
      'Time of discovery and communication',
      'Recipient information and verification',
      'Clinical context and recommendations',
      'Follow-up plan documentation'
    ];

    return {
      type: 'critical_finding',
      data: {
        finding,
        severity,
        communication_protocol: communicationProtocol,
        documentation_requirements: documentationRequirements,
        escalation_procedures: escalationProcedures,
        communication_method: communication_method || 'phone',
        recipient: recipient || 'ordering_physician',
        timestamp: new Date(),
        next_steps: ['Complete documentation and verify communication receipt']
      }
    };
  }

  /**
   * Process consultation request
   */
  async processConsultationRequest(sessionState, data) {
    const { consult_reason, requested_specialty, urgency, clinical_question } = data;
    const dossier = sessionState.clinicalDossier;

    // Simulate consultation process
    let consultationAssessment = [];
    let appropriatenessScore = this.assessConsultationAppropriateness(consult_reason, requested_specialty);
    let alternativeOptions = [];

    if (appropriatenessScore < 70) {
      alternativeOptions = this.suggestAlternativeOptions(consult_reason, requested_specialty);
    }

    consultationAssessment.push({
      consult_reason,
      requested_specialty,
      appropriateness_score: appropriatenessScore,
      clinical_urgency: urgency || 'routine',
      turnaround_expectation: this.calculateConsultationTurnaround(urgency)
    });

    return {
      type: 'consultation_request',
      data: {
        consultation_assessment: consultationAssessment,
        alternative_options: alternativeOptions,
        communication_requirements: [
          'Clear clinical question formulation',
          'Relevant clinical information sharing',
          'Timely response expectation setting',
          'Documentation of consult request and response'
        ],
        next_steps: ['Await consultant response and integrate recommendations']
      }
    };
  }

  // Helper methods

  calculateAppropriatenessScore(clinicalIndication, modality) {
    // Simple appropriateness scoring based on common clinical scenarios
    const appropriatenessMatrix = {
      'chest_pain': { 'CT': 95, 'X-ray': 70, 'MRI': 60, 'Ultrasound': 40 },
      'headache': { 'CT': 85, 'MRI': 90, 'X-ray': 20, 'Ultrasound': 10 },
      'abdominal_pain': { 'CT': 90, 'Ultrasound': 85, 'X-ray': 65, 'MRI': 75 },
      'trauma': { 'CT': 95, 'X-ray': 80, 'Ultrasound': 60, 'MRI': 50 }
    };

    const score = appropriatenessMatrix[clinicalIndication]?.[modality] || 50;
    return Math.min(100, Math.max(0, score));
  }

  getAlternativeStudies(clinicalIndication, currentModality) {
    const alternatives = {
      'CT': ['MRI', 'Ultrasound', 'X-ray'],
      'MRI': ['CT', 'Ultrasound', 'X-ray'],
      'X-ray': ['CT', 'MRI', 'Ultrasound'],
      'Ultrasound': ['CT', 'MRI', 'X-ray']
    };

    return alternatives[currentModality] || ['CT', 'MRI', 'X-ray', 'Ultrasound'];
  }

  generateSelectionRationale(clinicalIndication, modality, score) {
    const rationales = {
      high: `Excellent choice for ${clinicalIndication}. ${modality} provides optimal diagnostic yield with appropriate risk-benefit ratio.`,
      medium: `Reasonable choice for ${clinicalIndication}. Consider alternative modalities if clinically indicated.`,
      low: `Suboptimal choice for ${clinicalIndication}. Strongly consider alternative imaging modalities.`
    };

    if (score >= 80) return rationales.high;
    if (score >= 60) return rationales.medium;
    return rationales.low;
  }

  isRadiationStudy(modality) {
    return ['CT', 'X-ray', 'Fluoroscopy', 'Nuclear'].includes(modality);
  }

  assessContrastUsage(contrastType, considerations) {
    // Simple contrast assessment logic
    return {
      aspect: 'Contrast usage',
      status: 'appropriate',
      details: `${contrastType} contrast appropriately selected based on clinical considerations`
    };
  }

  calculateRadiationDose(modality, technique) {
    // Simple dose estimation
    const doseEstimates = {
      'CT': '5-10 mSv',
      'X-ray': '0.1-1.0 mSv',
      'Fluoroscopy': '2-15 mSv',
      'MRI': '0 mSv',
      'Ultrasound': '0 mSv'
    };

    return doseEstimates[modality] || 'Variable';
  }

  assessInterpretationQuality(findings) {
    const correctlyIdentified = findings.filter(f => f.status === 'correctly_identified').length;
    const totalExpected = findings.length;
    const accuracy = totalExpected > 0 ? (correctlyIdentified / totalExpected) * 100 : 100;

    if (accuracy >= 90) return 'excellent';
    if (accuracy >= 75) return 'good';
    if (accuracy >= 60) return 'fair';
    return 'needs_improvement';
  }

  generateDifferentialConsiderations(findings) {
    const pathologicalFindings = findings.filter(f => f.status === 'correctly_identified');
    return pathologicalFindings.map(finding => ({
      finding: finding.finding,
      differential: ['Primary consideration', 'Alternative diagnosis', 'Rare possibility']
    }));
  }

  assessDocumentationCompleteness(finding) {
    const requiredElements = ['description', 'location', 'size', 'characteristics', 'significance'];
    const presentElements = Object.keys(finding).filter(key => finding[key] && finding[key] !== '');
    const missingElements = requiredElements.filter(el => !presentElements.includes(el));

    return {
      score: ((requiredElements.length - missingElements.length) / requiredElements.length) * 100,
      missingElements,
      recommendations: missingElements.map(el => `Include ${el} in documentation`)
    };
  }

  assessCategorizationAccuracy(userCategorization, expectedFindings) {
    // Simple categorization accuracy assessment
    return userCategorization.map(cat => ({
      category: cat.type,
      accuracy: 'high',
      alignment: 'consistent with expected findings'
    }));
  }

  hasCriticalFindings(findings) {
    const criticalKeywords = ['rupture', 'hemorrhage', 'infarction', 'obstruction', 'perforation', 'tension'];
    return findings?.some(finding => 
      criticalKeywords.some(keyword => finding.description?.toLowerCase().includes(keyword))
    );
  }

  calculateReportingDeadline(urgency) {
    const deadlines = {
      'stat': '15 minutes',
      'urgent': '1 hour',
      'routine': '24 hours',
      'elective': '48 hours'
    };
    return deadlines[urgency] || '24 hours';
  }

  calculateCompletenessScore(assessment) {
    const totalScore = assessment.reduce((sum, item) => sum + item.completeness_score, 0);
    return assessment.length > 0 ? totalScore / assessment.length : 100;
  }

  calculateAccuracyScore(assessment) {
    return assessment.length > 0 ? 85 : 100; // Placeholder logic
  }

  assessFindingsSummary(summary, dossier) {
    return {
      aspect: 'Findings summary',
      completeness: 'good',
      clarity: 'clear',
      organization: 'well_structured'
    };
  }

  assessImpressionQuality(impression, dossier) {
    return {
      aspect: 'Impression',
      clarity: 'clear',
      clinical_relevance: 'high',
      actionability: 'specific'
    };
  }

  determineCommunicationStatus(dossier) {
    return dossier.radiation_safety?.communication_required ? 'requires_communication' : 'routine';
  }

  assessDoseOptimization(optimization, radiationSafety) {
    return {
      aspect: 'Dose optimization',
      status: 'optimized',
      optimization_opportunities: ['Lower kVp settings', 'Reduced scan length', 'Iterative reconstruction']
    };
  }

  assessSafetyProtocolCompliance(protocols, radiationSafety) {
    return {
      aspect: 'Safety protocol compliance',
      status: 'compliant',
      compliance_issues: ['Missing pregnancy screening documentation']
    };
  }

  assessPatientProtection(protection, radiationSafety) {
    return {
      aspect: 'Patient protection',
      status: 'adequate',
      recommendations: ['Additional shielding for sensitive organs']
    };
  }

  getAlaraPrinciples() {
    return [
      'Justification: Ensure exam is clinically indicated',
      'Optimization: Use lowest dose necessary for diagnostic quality',
      'Limitation: Keep doses as low as reasonably achievable',
      'Documentation: Record all dose parameters and optimizations'
    ];
  }

  assessConsultationAppropriateness(reason, specialty) {
    return 85; // Placeholder
  }

  suggestAlternativeOptions(reason, specialty) {
    return ['Additional imaging', 'Clinical follow-up', 'Second opinion'];
  }

  calculateConsultationTurnaround(urgency) {
    return urgency === 'stat' ? '15 minutes' : '4 hours';
  }

  /**
   * Get radiology-specific evaluation criteria
   */
  getRadiologyEvaluationCriteria() {
    return {
      systematic_approach: { weight: 0.25, description: 'Structured image review and analysis' },
      finding_identification: { weight: 0.30, description: 'Accurate detection and characterization of findings' },
      differential_diagnosis: { weight: 0.25, description: 'Appropriate differential considerations' },
      reporting_quality: { weight: 0.15, description: 'Clear and comprehensive reporting' },
      radiation_safety: { weight: 0.05, description: 'Radiation safety and optimization' }
    };
  }
}

export default new RadiologySimulationService();
import mongoose from 'mongoose';
import { getEvaluation } from './aiService.js';
import Case from '../models/CaseModel.js';
import Session from '../models/SessionModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import auditLogger from './AuditLoggerService.js';

/**
 * Laboratory Simulation Service
 * Handles laboratory-specific case simulation for specimen processing and testing workflows
 */
class LaboratorySimulationService {
  constructor() {
    this.laboratoryActions = new Map([
      ['specimen_receipt', this.processSpecimenReceipt.bind(this)],
      ['quality_control', this.processQualityControl.bind(this)],
      ['test_execution', this.processTestExecution.bind(this)],
      ['result_interpretation', this.processResultInterpretation.bind(this)],
      ['safety_incident', this.processSafetyIncident.bind(this)],
      ['critical_value', this.processCriticalValue.bind(this)]
    ]);
  }

  /**
   * Process laboratory-specific action
   * @param {Object} sessionState - Current session state
   * @param {Object} action - User action
   * @returns {Promise<Object>} - System response
   */
  async processLaboratoryAction(sessionState, action) {
    const actionHandler = this.laboratoryActions.get(action.type);
    if (!actionHandler) {
      throw new Error(`Unknown laboratory action type: ${action.type}`);
    }

    return await actionHandler(sessionState, action.data);
  }

  /**
   * Process specimen receipt and verification
   */
  async processSpecimenReceipt(sessionState, data) {
    const { specimen_id, verification_steps } = data;
    const dossier = sessionState.clinicalDossier;
    const specimenInfo = dossier.specimen_information;

    // Simulate specimen verification
    let verificationResults = [];
    let acceptanceStatus = 'accepted';
    let issues = [];

    // Check specimen quality
    if (specimenInfo.specimen_quality !== 'acceptable') {
      acceptanceStatus = 'rejected';
      issues.push(`Specimen quality issue: ${specimenInfo.specimen_quality}`);
    }

    // Check labeling accuracy
    if (specimenInfo.labeling_accuracy !== 'correct') {
      acceptanceStatus = 'rejected';
      issues.push('Labeling inaccuracies detected');
    }

    // Check volume adequacy
    if (specimenInfo.volume_adequacy === 'insufficient') {
      acceptanceStatus = 'rejected';
      issues.push('Insufficient specimen volume');
    }

    verificationResults.push({
      step: 'Specimen verification',
      status: acceptanceStatus,
      issues: issues.length > 0 ? issues : ['No issues detected'],
      timestamp: new Date()
    });

    return {
      type: 'specimen_verification',
      data: {
        specimen_id,
        acceptance_status: acceptanceStatus,
        verification_results: verificationResults,
        next_steps: acceptanceStatus === 'accepted' ? 
          ['Proceed to processing'] : 
          ['Notify collector for recollection']
      }
    };
  }

  /**
   * Process quality control procedures
   */
  async processQualityControl(sessionState, data) {
    const { qc_type, instrument, test_name } = data;
    const dossier = sessionState.clinicalDossier;
    const qcData = dossier.quality_control;

    // Simulate QC results
    let qcResults = [];
    let qcStatus = 'pass';
    let violations = [];

    // Check against Westgard rules or other QC rules
    if (qcData.qc_rules && qcData.qc_rules[test_name]) {
      const rules = qcData.qc_rules[test_name];
      // Simulate rule violations based on hidden results
      if (dossier.hidden_results && dossier.hidden_results[test_name]) {
        const result = dossier.hidden_results[test_name];
        if (result > rules.upper_limit || result < rules.lower_limit) {
          violations.push('1-2s rule violation');
          qcStatus = 'fail';
        }
      }
    }

    qcResults.push({
      test_name,
      qc_type,
      instrument,
      status: qcStatus,
      violations: violations.length > 0 ? violations : ['No violations'],
      timestamp: new Date()
    });

    return {
      type: 'quality_control',
      data: {
        qc_results: qcResults,
        overall_status: qcStatus,
        corrective_actions: qcStatus === 'fail' ? 
          ['Repeat QC', 'Check calibration', 'Notify supervisor'] : 
          ['Proceed with testing']
      }
    };
  }

  /**
   * Process test execution
   */
  async processTestExecution(sessionState, data) {
    const { test_name, instrument, parameters } = data;
    const dossier = sessionState.clinicalDossier;
    const hiddenResults = dossier.hidden_results || {};

    // Simulate test execution
    let testResults = [];
    let technicalIssues = [];

    // Get actual result from hidden data or simulate
    const actualResult = hiddenResults[test_name] || this.generateTestResult(test_name);
    const referenceRange = dossier.test_requests?.reference_ranges?.[test_name] || 'Not specified';

    // Check for technical issues
    if (dossier.analytical_phase?.technical_issues?.includes(test_name)) {
      technicalIssues.push(`Technical issue with ${test_name}`);
    }

    testResults.push({
      test_name,
      result: actualResult,
      units: 'See reference',
      reference_range: referenceRange,
      status: 'completed',
      technical_issues: technicalIssues,
      timestamp: new Date()
    });

    return {
      type: 'test_results',
      data: {
        test_results: testResults,
        interpretation: this.interpretResult(actualResult, referenceRange, test_name),
        next_steps: ['Verify results', 'Check for critical values']
      }
    };
  }

  /**
   * Process result interpretation
   */
  async processResultInterpretation(sessionState, data) {
    const { test_name, result, clinical_correlation } = data;
    const dossier = sessionState.clinicalDossier;

    // Simulate result interpretation
    let interpretation = '';
    let clinicalSignificance = '';
    let recommendations = [];

    // Basic interpretation logic
    const referenceRange = dossier.test_requests?.reference_ranges?.[test_name];
    if (referenceRange) {
      const [lower, upper] = referenceRange.split('-').map(Number);
      if (result < lower) {
        interpretation = 'Below reference range';
        clinicalSignificance = 'Possible deficiency or underlying condition';
      } else if (result > upper) {
        interpretation = 'Above reference range';
        clinicalSignificance = 'Possible excess or pathological condition';
      } else {
        interpretation = 'Within reference range';
        clinicalSignificance = 'Normal finding';
      }
    }

    // Add case-specific interpretations from hidden data
    if (dossier.result_interpretation) {
      interpretation += ` ${dossier.result_interpretation}`;
    }

    recommendations.push(
      'Correlate with clinical presentation',
      'Consider repeat testing if indicated',
      'Consult with ordering physician if critical'
    );

    return {
      type: 'result_interpretation',
      data: {
        test_name,
        result,
        interpretation,
        clinical_significance: clinicalSignificance,
        recommendations,
        reporting_required: true
      }
    };
  }

  /**
   * Process safety incidents
   */
  async processSafetyIncident(sessionState, data) {
    const { incident_type, severity, location } = data;
    const dossier = sessionState.clinicalDossier;

    // Simulate safety incident response
    let emergencyProcedures = [];
    let reportingRequirements = [];

    switch (incident_type) {
      case 'chemical_spill':
        emergencyProcedures = [
          'Evacuate immediate area',
          'Don appropriate PPE',
          'Contain spill using absorbent materials',
          'Notify safety officer'
        ];
        reportingRequirements = [
          'Complete incident report',
          'Document chemicals involved',
          'Report to institutional safety committee'
        ];
        break;
      case 'biological_exposure':
        emergencyProcedures = [
          'Wash affected area immediately',
          'Seek medical attention',
          'Report exposure to supervisor',
          'Complete exposure incident form'
        ];
        reportingRequirements = [
          'Document exposure details',
          'Report to employee health',
          'Follow post-exposure protocol'
        ];
        break;
      default:
        emergencyProcedures = ['Follow general emergency procedures'];
        reportingRequirements = ['Document incident in safety log'];
    }

    return {
      type: 'safety_incident',
      data: {
        incident_type,
        severity,
        location,
        emergency_procedures: emergencyProcedures,
        reporting_requirements: reportingRequirements,
        follow_up: ['Investigate root cause', 'Implement corrective actions']
      }
    };
  }

  /**
   * Process critical values
   */
  async processCriticalValue(sessionState, data) {
    const { test_name, result, patient_info } = data;
    const dossier = sessionState.clinicalDossier;

    // Simulate critical value handling
    let criticalActions = [];
    let communicationProtocol = [];

    criticalActions.push(
      'Verify result accuracy',
      'Repeat testing if indicated',
      'Document critical value'
    );

    communicationProtocol.push(
      'Notify ordering physician immediately',
      'Use read-back verification',
      'Document time of notification and recipient',
      'Escalate if unable to reach ordering physician'
    );

    return {
      type: 'critical_value',
      data: {
        test_name,
        result,
        critical: true,
        actions: criticalActions,
        communication_protocol: communicationProtocol,
        documentation: [
          'Critical value report form',
          'Laboratory information system entry',
          'Quality assurance log'
        ]
      }
    };
  }

  /**
   * Generate realistic test result based on test name
   */
  generateTestResult(testName) {
    // Simple result generation based on test type
    const testResults = {
      'CBC': {
        'WBC': '6.5 x 10^9/L',
        'RBC': '4.8 x 10^12/L',
        'HGB': '14.2 g/dL',
        'HCT': '42%',
        'PLT': '250 x 10^9/L'
      },
      'BMP': {
        'Sodium': '140 mmol/L',
        'Potassium': '4.2 mmol/L',
        'Chloride': '102 mmol/L',
        'CO2': '26 mmol/L',
        'Glucose': '95 mg/dL',
        'BUN': '15 mg/dL',
        'Creatinine': '0.9 mg/dL'
      },
      'LFT': {
        'ALT': '25 U/L',
        'AST': '22 U/L',
        'ALP': '85 U/L',
        'Total Bilirubin': '0.8 mg/dL',
        'Direct Bilirubin': '0.2 mg/dL'
      }
    };

    // Return a random result from the test category
    const category = testName.split(' ')[0]; // Simple categorization
    const results = testResults[category] || { 'Result': '12.5 units' };
    const keys = Object.keys(results);
    return results[keys[Math.floor(Math.random() * keys.length)]];
  }

  /**
   * Interpret test result against reference range
   */
  interpretResult(result, referenceRange, testName) {
    if (!referenceRange || referenceRange === 'Not specified') {
      return 'Interpretation requires clinical correlation';
    }

    try {
      const [lower, upper] = referenceRange.split('-').map(Number);
      const numericResult = parseFloat(result);

      if (isNaN(numericResult)) {
        return 'Non-numeric result - requires manual review';
      }

      if (numericResult < lower) {
        return `Low ${testName} - possible deficiency`;
      } else if (numericResult > upper) {
        return `High ${testName} - possible excess`;
      } else {
        return `Normal ${testName}`;
      }
    } catch (error) {
      return 'Unable to interpret - invalid reference range format';
    }
  }

  /**
   * Get laboratory-specific evaluation criteria
   */
  getLaboratoryEvaluationCriteria() {
    return {
      specimen_handling: { weight: 0.15, description: 'Proper specimen collection and processing' },
      quality_control: { weight: 0.20, description: 'QC procedures and troubleshooting' },
      technical_competency: { weight: 0.20, description: 'Test execution and instrument operation' },
      result_interpretation: { weight: 0.20, description: 'Result analysis and clinical correlation' },
      safety_protocols: { weight: 0.15, description: 'Safety compliance and incident response' },
      timeliness: { weight: 0.10, description: 'Meeting turnaround times and deadlines' }
    };
  }
}

export default new LaboratorySimulationService();
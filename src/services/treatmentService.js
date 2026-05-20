import Case from '../models/CaseModel.js';
import Session from '../models/SessionModel.js';

class TreatmentService {
  /**
   * Analyze treatment decisions and provide feedback
   * @param {string} sessionId - The session ID
   * @param {Array} treatmentPlan - Array of treatment interventions
   * @returns {Object} Feedback on treatment appropriateness
   */
  static async analyzeTreatmentPlan(sessionId, treatmentPlan) {
    try {
      const session = await Session.findById(sessionId).populate('case_ref');
      if (!session) {
        throw new Error('Session not found');
      }

      const caseData = session.case_ref;
      const hiddenDiagnosis = caseData.clinical_dossier?.hidden_diagnosis;
      const expectedTreatments = caseData.clinical_dossier?.treatment_plan?.immediate || [];

      // Simple analysis - in real implementation, this would use AI
      const analysis = {
        appropriateness_score: 0,
        feedback: [],
        correct_treatments: 0,
        incorrect_treatments: 0,
        missing_treatments: expectedTreatments.length
      };

      // Check each proposed treatment
      treatmentPlan.forEach(intervention => {
        const isAppropriate = this.isTreatmentAppropriate(intervention, expectedTreatments, hiddenDiagnosis);
        
        if (isAppropriate) {
          analysis.correct_treatments++;
          analysis.feedback.push({
            intervention: intervention.intervention,
            status: 'appropriate',
            feedback: 'This treatment is appropriate for the condition'
          });
        } else {
          analysis.incorrect_treatments++;
          analysis.feedback.push({
            intervention: intervention.intervention,
            status: 'inappropriate',
            feedback: 'This treatment may not be appropriate or could be harmful'
          });
        }
      });

      // Calculate score
      analysis.appropriateness_score = analysis.correct_treatments > 0 
        ? Math.round((analysis.correct_treatments / treatmentPlan.length) * 100)
        : 0;

      analysis.missing_treatments = Math.max(0, expectedTreatments.length - analysis.correct_treatments);

      return analysis;
    } catch (error) {
      console.error('Error analyzing treatment plan:', error);
      throw error;
    }
  }

  /**
   * Check if a treatment is appropriate for the condition
   * @param {Object} intervention - Proposed treatment
   * @param {Array} expectedTreatments - Expected treatments from case
   * @param {string} hiddenDiagnosis - The correct diagnosis
   * @returns {boolean} Whether treatment is appropriate
   */
  static isTreatmentAppropriate(intervention, expectedTreatments, hiddenDiagnosis) {
    // Simple string matching - in real implementation, this would use medical knowledge base
    const interventionLower = intervention.intervention.toLowerCase();
    
    // Check if intervention matches any expected treatments
    const matchesExpected = expectedTreatments.some(expected => 
      expected.toLowerCase().includes(interventionLower) ||
      interventionLower.includes(expected.toLowerCase())
    );

    // Additional safety checks based on diagnosis
    const isContraindicated = this.isTreatmentContraindicated(intervention, hiddenDiagnosis);
    
    return matchesExpected && !isContraindicated;
  }

  /**
   * Check if treatment is contraindicated for the diagnosis
   * @param {Object} intervention - Proposed treatment
   * @param {string} hiddenDiagnosis - The correct diagnosis
   * @returns {boolean} Whether treatment is contraindicated
   */
  static isTreatmentContraindicated(intervention, hiddenDiagnosis) {
    // Simple contraindication checks - would be expanded with medical knowledge
    const contraindications = {
      'aspirin': ['bleeding disorder', 'peptic ulcer', 'gastrointestinal bleeding'],
      'nsaids': ['renal failure', 'heart failure', 'hypertension'],
      'beta blockers': ['asthma', 'copd', 'heart block'],
      'ace inhibitors': ['pregnancy', 'renal artery stenosis']
    };

    const interventionLower = intervention.intervention.toLowerCase();
    const diagnosisLower = hiddenDiagnosis.toLowerCase();

    for (const [med, conditions] of Object.entries(contraindications)) {
      if (interventionLower.includes(med) && conditions.some(condition => diagnosisLower.includes(condition))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simulate treatment outcomes based on treatment plan
   * @param {string} sessionId - The session ID
   * @param {Array} treatmentPlan - Array of treatment interventions
   * @returns {Object} Simulated outcomes
   */
  static async simulateTreatmentOutcomes(sessionId, treatmentPlan) {
    try {
      const session = await Session.findById(sessionId).populate('case_ref');
      if (!session) {
        throw new Error('Session not found');
      }

      const caseData = session.case_ref;
      const analysis = await this.analyzeTreatmentPlan(sessionId, treatmentPlan);

      // Simulate outcomes based on treatment appropriateness
      const outcomes = {
        patient_response: '',
        vital_signs: {},
        lab_results: {},
        complications: [],
        overall_outcome: ''
      };

      if (analysis.appropriateness_score >= 80) {
        outcomes.patient_response = 'Patient shows significant improvement. Symptoms are resolving.';
        outcomes.vital_signs = { bp: '120/80', hr: '72', rr: '16', temp: '98.6°F' };
        outcomes.overall_outcome = 'Excellent response to treatment';
      } else if (analysis.appropriateness_score >= 50) {
        outcomes.patient_response = 'Patient shows some improvement but symptoms persist.';
        outcomes.vital_signs = { bp: '130/85', hr: '88', rr: '18', temp: '99.1°F' };
        outcomes.overall_outcome = 'Partial response to treatment';
      } else {
        outcomes.patient_response = 'Patient condition unchanged or worsening.';
        outcomes.vital_signs = { bp: '145/95', hr: '105', rr: '22', temp: '100.4°F' };
        outcomes.complications = ['Treatment side effects observed', 'Condition progression'];
        outcomes.overall_outcome = 'Poor response to treatment';
      }

      // Add lab results based on diagnosis
      outcomes.lab_results = this.generateLabResults(caseData, analysis);

      return {
        analysis,
        outcomes
      };
    } catch (error) {
      console.error('Error simulating treatment outcomes:', error);
      throw error;
    }
  }

  /**
   * Generate simulated lab results based on case and treatment
   * @param {Object} caseData - Case data
   * @param {Object} analysis - Treatment analysis
   * @returns {Object} Lab results
   */
  static generateLabResults(caseData, analysis) {
    const hiddenDiagnosis = caseData.clinical_dossier?.hidden_diagnosis?.toLowerCase() || '';
    const results = {};

    if (hiddenDiagnosis.includes('infection')) {
      results.wbc = analysis.appropriateness_score >= 50 ? '8.5 (normal)' : '15.2 (elevated)';
      results.crp = analysis.appropriateness_score >= 50 ? '5 mg/L' : '85 mg/L';
    } else if (hiddenDiagnosis.includes('cardiac')) {
      results.troponin = analysis.appropriateness_score >= 50 ? '0.01 ng/mL' : '1.5 ng/mL';
      results.ck_mb = analysis.appropriateness_score >= 50 ? '4 ng/mL' : '25 ng/mL';
    } else if (hiddenDiagnosis.includes('renal')) {
      results.creatinine = analysis.appropriateness_score >= 50 ? '1.1 mg/dL' : '3.8 mg/dL';
      results.bun = analysis.appropriateness_score >= 50 ? '18 mg/dL' : '45 mg/dL';
    }

    return results;
  }

  /**
   * Update session with treatment decisions
   * @param {string} sessionId - The session ID
   * @param {Array} treatmentPlan - Array of treatment interventions
   * @returns {Object} Updated session
   */
  static async recordTreatmentDecisions(sessionId, treatmentPlan) {
    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Add treatment decisions to session
      treatmentPlan.forEach(intervention => {
        session.treatment_plan.push({
          intervention: intervention.intervention,
          dosage: intervention.dosage,
          frequency: intervention.frequency,
          timestamp: new Date()
        });
      });

      await session.save();
      return session;
    } catch (error) {
      console.error('Error recording treatment decisions:', error);
      throw error;
    }
  }
}

export default TreatmentService;
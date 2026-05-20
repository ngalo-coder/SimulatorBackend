import mongoose from 'mongoose';
import auditLogger from './AuditLoggerService.js';

/**
 * Case Template Service
 * Provides discipline-specific case templates for healthcare education
 * Supports Medicine, Nursing, Laboratory, Radiology, and Pharmacy disciplines
 */
class CaseTemplateService {
  constructor() {
    this.templates = {
      medicine: this.getMedicalTemplate(),
      nursing: this.getNursingTemplate(),
      laboratory: this.getLaboratoryTemplate(),
      radiology: this.getRadiologyTemplate(),
      pharmacy: this.getPharmacyTemplate()
    };

    this.templateMetadata = {
      medicine: {
        name: 'Medical Case Template',
        description: 'Comprehensive template for clinical presentation and diagnosis',
        icon: 'stethoscope',
        color: '#e74c3c',
        version: '1.0.0'
      },
      nursing: {
        name: 'Nursing Case Template',
        description: 'Patient care scenarios with nursing interventions',
        icon: 'heart',
        color: '#3498db',
        version: '1.0.0'
      },
      laboratory: {
        name: 'Laboratory Case Template',
        description: 'Specimen processing and diagnostic testing workflows',
        icon: 'flask',
        color: '#9b59b6',
        version: '1.0.0'
      },
      radiology: {
        name: 'Radiology Case Template',
        description: 'Imaging interpretation and diagnostic reporting',
        icon: 'x-ray',
        color: '#f39c12',
        version: '1.0.0'
      },
      pharmacy: {
        name: 'Pharmacy Case Template',
        description: 'Medication therapy management and patient counseling',
        icon: 'pills',
        color: '#27ae60',
        version: '1.0.0'
      }
    };
  }

  /**
   * Get all available templates
   * @returns {Object} - All case templates with metadata
   */
  getAllTemplates() {
    return Object.keys(this.templates).map(discipline => ({
      discipline,
      metadata: this.templateMetadata[discipline],
      template: this.templates[discipline]
    }));
  }

  /**
   * Get template by discipline
   * @param {string} discipline - Healthcare discipline
   * @returns {Object} - Template structure for the discipline
   */
  getTemplate(discipline) {
    const template = this.templates[discipline.toLowerCase()];
    if (!template) {
      throw new Error(`Template not found for discipline: ${discipline}`);
    }

    return {
      discipline,
      metadata: this.templateMetadata[discipline.toLowerCase()],
      template
    };
  }

  /**
   * Validate case data against template
   * @param {Object} caseData - Case data to validate
   * @param {string} discipline - Healthcare discipline
   * @returns {Object} - Validation result
   */
  validateCaseData(caseData, discipline) {
    const template = this.templates[discipline.toLowerCase()];
    if (!template) {
      return {
        isValid: false,
        errors: [`Invalid discipline: ${discipline}`]
      };
    }

    const errors = [];
    const warnings = [];

    // Validate required sections
    this.validateRequiredSections(caseData, template, errors);
    
    // Validate field types and constraints
    this.validateFieldTypes(caseData, template, errors, warnings);
    
    // Discipline-specific validation
    this.validateDisciplineSpecific(caseData, discipline, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create case from template
   * @param {string} discipline - Healthcare discipline
   * @param {Object} customData - Custom data to populate template
   * @param {Object} user - User creating the case
   * @returns {Object} - Case data structure
   */
  createCaseFromTemplate(discipline, customData = {}, user) {
    const template = this.getTemplate(discipline);
    
    // Deep clone template to avoid mutations
    const caseData = JSON.parse(JSON.stringify(template.template));
    
    // Merge custom data
    this.mergeCustomData(caseData, customData);
    
    // Set metadata
    caseData.case_metadata = {
      ...caseData.case_metadata,
      case_id: this.generateCaseId(discipline),
      specialty: discipline,
      created_from_template: true,
      template_version: template.metadata.version,
      created_by: user._id,
      created_at: new Date()
    };

    return caseData;
  }

  /**
   * Medical Case Template
   * Comprehensive template for clinical presentation and diagnosis
   */
  getMedicalTemplate() {
    return {
      case_metadata: {
        title: '',
        specialty: 'medicine',
        subspecialty: '',
        difficulty: 'intermediate',
        estimated_duration: 45,
        learning_objectives: [],
        keywords: [],
        case_type: 'clinical_case',
        location: 'emergency_department'
      },
      description: '',
      system_instruction: 'You are an experienced physician evaluating a patient. Provide thorough clinical reasoning and evidence-based recommendations.',
      patient_persona: {
        name: '',
        age: null,
        gender: '',
        occupation: '',
        chief_complaint: '',
        emotional_tone: 'concerned',
        medical_history: [],
        medications: [],
        allergies: [],
        social_history: {
          smoking: '',
          alcohol: '',
          drugs: '',
          occupation_details: ''
        },
        family_history: []
      },
      clinical_dossier: {
        history_of_presenting_illness: {
          onset: '',
          duration: '',
          character: '',
          location: '',
          radiation: '',
          associated_symptoms: [],
          aggravating_factors: [],
          relieving_factors: [],
          severity: null,
          timing: ''
        },
        review_of_systems: {
          constitutional: [],
          cardiovascular: [],
          respiratory: [],
          gastrointestinal: [],
          genitourinary: [],
          musculoskeletal: [],
          neurological: [],
          psychiatric: [],
          endocrine: [],
          hematologic: [],
          dermatologic: []
        },
        physical_examination: {
          vital_signs: {
            blood_pressure: '',
            heart_rate: '',
            respiratory_rate: '',
            temperature: '',
            oxygen_saturation: '',
            pain_score: ''
          },
          general_appearance: '',
          head_neck: '',
          cardiovascular: '',
          respiratory: '',
          abdominal: '',
          extremities: '',
          neurological: '',
          skin: ''
        },
        diagnostic_tests: {
          laboratory: [],
          imaging: [],
          procedures: [],
          ecg: '',
          other: []
        },
        hidden_diagnosis: '',
        differential_diagnosis: [],
        treatment_plan: {
          immediate: [],
          medications: [],
          procedures: [],
          monitoring: [],
          discharge_planning: []
        },
        prognosis: '',
        complications: []
      },
      initial_prompt: 'A patient presents to the emergency department with...',
      simulation_triggers: {
        time_based: [],
        action_based: [],
        decision_points: []
      },
      evaluation_criteria: {
        history_taking: { weight: 0.25, max_score: 100 },
        physical_examination: { weight: 0.20, max_score: 100 },
        diagnostic_reasoning: { weight: 0.25, max_score: 100 },
        treatment_planning: { weight: 0.20, max_score: 100 },
        communication: { weight: 0.10, max_score: 100 }
      }
    };
  }

  /**
   * Nursing Case Template
   * Patient care scenarios with nursing interventions
   */
  getNursingTemplate() {
    return {
      case_metadata: {
        title: '',
        specialty: 'nursing',
        subspecialty: '',
        difficulty: 'intermediate',
        estimated_duration: 40,
        learning_objectives: [],
        keywords: [],
        case_type: 'patient_care',
        location: 'medical_ward'
      },
      description: '',
      system_instruction: 'You are a registered nurse providing comprehensive patient care. Focus on nursing assessments, interventions, and patient safety.',
      patient_persona: {
        name: '',
        age: null,
        gender: '',
        admission_reason: '',
        emotional_tone: 'anxious',
        medical_history: [],
        current_medications: [],
        allergies: [],
        support_system: {
          family_present: false,
          primary_caregiver: '',
          cultural_considerations: ''
        },
        mobility_status: '',
        cognitive_status: ''
      },
      clinical_dossier: {
        nursing_assessment: {
          primary_concern: '',
          pain_assessment: {
            location: '',
            intensity: null,
            character: '',
            frequency: '',
            triggers: []
          },
          vital_signs_trends: [],
          neurological_status: '',
          cardiovascular_status: '',
          respiratory_status: '',
          gastrointestinal_status: '',
          genitourinary_status: '',
          integumentary_status: '',
          psychosocial_status: ''
        },
        nursing_diagnoses: [],
        care_plan: {
          priority_interventions: [],
          safety_measures: [],
          monitoring_parameters: [],
          patient_education: [],
          discharge_planning: []
        },
        medication_administration: {
          scheduled_medications: [],
          prn_medications: [],
          medication_reconciliation: [],
          patient_education: []
        },
        patient_safety: {
          fall_risk_assessment: '',
          pressure_ulcer_risk: '',
          infection_control_measures: [],
          safety_interventions: []
        },
        hidden_complications: [],
        expected_outcomes: []
      },
      initial_prompt: 'You are assigned to care for a patient who...',
      simulation_triggers: {
        patient_deterioration: [],
        medication_events: [],
        family_interactions: [],
        shift_changes: []
      },
      evaluation_criteria: {
        assessment_skills: { weight: 0.25, max_score: 100 },
        nursing_interventions: { weight: 0.25, max_score: 100 },
        patient_safety: { weight: 0.20, max_score: 100 },
        communication: { weight: 0.15, max_score: 100 },
        documentation: { weight: 0.15, max_score: 100 }
      }
    };
  }

  /**
   * Laboratory Case Template
   * Specimen processing and diagnostic testing workflows with enhanced fields for simulation
   */
  getLaboratoryTemplate() {
    return {
      case_metadata: {
        title: '',
        specialty: 'laboratory',
        subspecialty: '',
        difficulty: 'intermediate',
        estimated_duration: 35,
        learning_objectives: [],
        keywords: [],
        case_type: 'diagnostic_testing',
        location: 'clinical_laboratory',
        department: 'general', // e.g., hematology, microbiology, chemistry
        accreditation_standards: ['ISO 15189', 'CLIA'] // Relevant standards
      },
      description: '',
      system_instruction: 'You are a medical laboratory scientist processing specimens and interpreting results. Ensure accuracy, quality control, and adherence to safety protocols. Follow standard operating procedures for each test.',
      patient_persona: {
        name: '',
        age: null,
        gender: '',
        clinical_information: '',
        ordering_physician: '',
        urgency_level: 'routine', // routine, urgent, stat
        specimen_source: '',
        patient_id: '',
        collection_date: '',
        collector: ''
      },
      clinical_dossier: {
        specimen_information: {
          specimen_type: '', // e.g., blood, urine, tissue
          collection_method: '', // e.g., venipuncture, swab
          collection_time: '',
          transport_conditions: '', // e.g., room temp, refrigerated
          specimen_quality: '', // e.g., acceptable, hemolyzed, clotted
          volume_adequacy: '', // sufficient, insufficient
          labeling_accuracy: '', // correct, incorrect
          stability: '', // stable, unstable
          contamination_risk: '' // low, medium, high
        },
        test_requests: {
          ordered_tests: [], // array of test objects
          test_priorities: [], // routine, urgent, stat
          special_instructions: [], // e.g., repeat if positive, add-on test
          reference_ranges: {}, // test-specific reference ranges
          turnaround_times: {} // expected TAT for each test
        },
        pre_analytical_phase: {
          specimen_processing: [], // steps like centrifugation, aliquoting
          quality_checks: [], // checks upon receipt
          storage_conditions: '', // e.g., 2-8°C, -20°C
          preparation_steps: [], // pre-test preparation
          rejection_criteria: [], // reasons for specimen rejection
          acceptance_status: '' // accepted, rejected
        },
        analytical_phase: {
          instrumentation: [], // instruments used for testing
          calibration_status: '', // calibrated, needs calibration
          quality_control_results: [], // QC data for each test
          test_procedures: [], // step-by-step procedures
          technical_issues: [], // any issues during testing
          reagent_lots: {}, // lot numbers and expirations
          environmental_conditions: {} // temperature, humidity
        },
        post_analytical_phase: {
          result_verification: [], // steps for result verification
          critical_values: [], // critical results to report
          result_interpretation: '', // clinical interpretation
          reporting_requirements: [], // how to report results
          delta_checks: [], // comparison with previous results
          autoverification_rules: [] // rules for auto-verification
        },
        quality_control: {
          qc_materials: [], // QC materials used
          qc_frequency: '', // daily, weekly, per run
          qc_rules: {}, // Westgard rules or other
          qc_failures: [], // any QC failures
          corrective_actions: [] // actions taken for failures
        },
        safety_protocols: {
          personal_protective_equipment: [], // required PPE
          biohazard_handling: '', // procedures for biohazards
          spill_procedures: '', // steps for spills
          waste_disposal: '', // disposal methods
          exposure_plan: '' // plan for exposures
        },
        hidden_results: {}, // actual results for evaluation
        expected_findings: [], // expected outcomes
        potential_interferences: [], // factors that may interfere
        case_challenges: [] // specific challenges for the case
      },
      initial_prompt: 'A specimen has arrived in the laboratory for testing. Begin by verifying the specimen and processing it according to standard protocols.',
      simulation_triggers: {
        quality_control_failures: [], // triggers for QC issues
        critical_results: [], // triggers for critical values
        specimen_problems: [], // triggers for specimen issues
        instrument_malfunctions: [], // triggers for instrument problems
        safety_incidents: [], // triggers for safety events
        reporting_deadlines: [] // triggers for TAT issues
      },
      evaluation_criteria: {
        specimen_handling: { weight: 0.15, max_score: 100 },
        quality_control: { weight: 0.20, max_score: 100 },
        technical_competency: { weight: 0.20, max_score: 100 },
        result_interpretation: { weight: 0.20, max_score: 100 },
        safety_protocols: { weight: 0.15, max_score: 100 },
        timeliness: { weight: 0.10, max_score: 100 } // added timeliness
      }
    };
  }
 /**
   * Radiology Case Template
   * Imaging interpretation and diagnostic reporting
   */
  getRadiologyTemplate() {
    return {
      case_metadata: {
        title: '',
        specialty: 'radiology',
        subspecialty: '',
        difficulty: 'intermediate',
        estimated_duration: 30,
        learning_objectives: [],
        keywords: [],
        case_type: 'imaging_interpretation',
        location: 'radiology_department'
      },
      description: '',
      system_instruction: 'You are a radiologist interpreting medical images. Provide systematic analysis and accurate diagnostic impressions.',
      patient_persona: {
        name: '',
        age: null,
        gender: '',
        clinical_history: '',
        referring_physician: '',
        clinical_question: '',
        previous_imaging: []
      },
      clinical_dossier: {
        imaging_study: {
          modality: '',
          study_type: '',
          technique: {
            contrast_used: false,
            contrast_type: '',
            acquisition_parameters: {},
            patient_positioning: ''
          },
          image_quality: {
            technical_adequacy: '',
            artifacts: [],
            limitations: []
          }
        },
        systematic_review: {
          anatomical_structures: [],
          normal_variants: [],
          pathological_findings: [],
          measurements: {},
          comparison_studies: []
        },
        imaging_findings: {
          primary_findings: [],
          secondary_findings: [],
          incidental_findings: [],
          normal_structures: []
        },
        differential_diagnosis: {
          most_likely: '',
          alternatives: [],
          additional_imaging: []
        },
        radiation_safety: {
          dose_considerations: '',
          justification: '',
          optimization: []
        },
        hidden_diagnosis: '',
        teaching_points: []
      },
      initial_prompt: 'Review the following imaging study and provide your interpretation...',
      simulation_triggers: {
        image_navigation: [],
        measurement_tools: [],
        comparison_requests: [],
        consultation_needs: []
      },
      evaluation_criteria: {
        systematic_approach: { weight: 0.25, max_score: 100 },
        finding_identification: { weight: 0.30, max_score: 100 },
        differential_diagnosis: { weight: 0.25, max_score: 100 },
        reporting_quality: { weight: 0.15, max_score: 100 },
        radiation_safety: { weight: 0.05, max_score: 100 }
      }
    };
  }

  /**
   * Pharmacy Case Template
   * Medication therapy management and patient counseling
   */
  getPharmacyTemplate() {
    return {
      case_metadata: {
        title: '',
        specialty: 'pharmacy',
        subspecialty: '',
        difficulty: 'intermediate',
        estimated_duration: 40,
        learning_objectives: [],
        keywords: [],
        case_type: 'medication_therapy',
        location: 'community_pharmacy'
      },
      description: '',
      system_instruction: 'You are a clinical pharmacist providing medication therapy management. Focus on drug safety, efficacy, and patient counseling.',
      patient_persona: {
        name: '',
        age: null,
        gender: '',
        chief_concern: '',
        insurance_status: '',
        health_literacy: '',
        language_preference: '',
        cultural_background: '',
        adherence_history: ''
      },
      clinical_dossier: {
        medication_history: {
          current_medications: [],
          recent_changes: [],
          over_the_counter: [],
          herbal_supplements: [],
          adherence_assessment: ''
        },
        medical_conditions: {
          active_diagnoses: [],
          chronic_conditions: [],
          allergies: [],
          adverse_drug_reactions: []
        },
        prescription_review: {
          new_prescriptions: [],
          refill_requests: [],
          prescription_issues: [],
          insurance_coverage: []
        },
        drug_therapy_problems: {
          indication_issues: [],
          effectiveness_concerns: [],
          safety_problems: [],
          adherence_barriers: []
        },
        pharmaceutical_care_plan: {
          therapy_goals: [],
          interventions: [],
          monitoring_parameters: [],
          patient_education: []
        },
        drug_interactions: {
          drug_drug: [],
          drug_food: [],
          drug_disease: [],
          severity_assessment: []
        },
        patient_counseling: {
          medication_education: [],
          administration_instructions: [],
          side_effects_discussion: [],
          monitoring_requirements: []
        },
        hidden_complications: [],
        expected_outcomes: []
      },
      initial_prompt: 'A patient approaches the pharmacy counter with...',
      simulation_triggers: {
        prescription_problems: [],
        drug_interactions: [],
        patient_questions: [],
        insurance_issues: []
      },
      evaluation_criteria: {
        medication_review: { weight: 0.25, max_score: 100 },
        drug_therapy_assessment: { weight: 0.25, max_score: 100 },
        patient_counseling: { weight: 0.25, max_score: 100 },
        safety_monitoring: { weight: 0.15, max_score: 100 },
        documentation: { weight: 0.10, max_score: 100 }
      }
    };
  }

  // Helper methods

  /**
   * Validate required sections
   */
  validateRequiredSections(caseData, template, errors) {
    const requiredSections = ['case_metadata', 'patient_persona', 'clinical_dossier'];
    
    requiredSections.forEach(section => {
      if (!caseData[section]) {
        errors.push(`Missing required section: ${section}`);
      }
    });

    // Validate case metadata required fields
    if (caseData.case_metadata) {
      const requiredMetadata = ['title', 'specialty', 'difficulty'];
      requiredMetadata.forEach(field => {
        if (!caseData.case_metadata[field]) {
          errors.push(`Missing required metadata field: ${field}`);
        }
      });
    }
  }

  /**
   * Validate field types and constraints
   */
  validateFieldTypes(caseData, template, errors, warnings) {
    // Validate difficulty levels
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (caseData.case_metadata?.difficulty && 
        !validDifficulties.includes(caseData.case_metadata.difficulty)) {
      errors.push(`Invalid difficulty level: ${caseData.case_metadata.difficulty}`);
    }

    // Validate estimated duration
    if (caseData.case_metadata?.estimated_duration) {
      const duration = caseData.case_metadata.estimated_duration;
      if (typeof duration !== 'number' || duration < 5 || duration > 180) {
        warnings.push('Estimated duration should be between 5 and 180 minutes');
      }
    }

    // Validate patient age
    if (caseData.patient_persona?.age) {
      const age = caseData.patient_persona.age;
      if (typeof age !== 'number' || age < 0 || age > 120) {
        errors.push('Patient age must be a number between 0 and 120');
      }
    }
  }

  /**
   * Validate discipline-specific requirements
   */
  validateDisciplineSpecific(caseData, discipline, errors, warnings) {
    switch (discipline.toLowerCase()) {
      case 'medicine':
        this.validateMedicalCase(caseData, errors, warnings);
        break;
      case 'nursing':
        this.validateNursingCase(caseData, errors, warnings);
        break;
      case 'laboratory':
        this.validateLaboratoryCase(caseData, errors, warnings);
        break;
      case 'radiology':
        this.validateRadiologyCase(caseData, errors, warnings);
        break;
      case 'pharmacy':
        this.validatePharmacyCase(caseData, errors, warnings);
        break;
    }
  }

  validateMedicalCase(caseData, errors, warnings) {
    if (!caseData.patient_persona?.chief_complaint) {
      errors.push('Medical cases require a chief complaint');
    }
    if (!caseData.clinical_dossier?.hidden_diagnosis) {
      errors.push('Medical cases require a hidden diagnosis');
    }
    if (!caseData.clinical_dossier?.physical_examination) {
      warnings.push('Physical examination section is recommended for medical cases');
    }
  }

  validateNursingCase(caseData, errors, warnings) {
    if (!caseData.patient_persona?.admission_reason) {
      errors.push('Nursing cases require an admission reason');
    }
    if (!caseData.clinical_dossier?.nursing_diagnoses || 
        caseData.clinical_dossier.nursing_diagnoses.length === 0) {
      warnings.push('Nursing diagnoses are recommended for nursing cases');
    }
  }

  validateLaboratoryCase(caseData, errors, warnings) {
    if (!caseData.clinical_dossier?.specimen_information) {
      errors.push('Laboratory cases require specimen information');
    }
    if (!caseData.clinical_dossier?.test_requests) {
      errors.push('Laboratory cases require test requests');
    }
    
    // Validate quality control section
    if (!caseData.clinical_dossier?.quality_control) {
      warnings.push('Quality control section is recommended for laboratory cases');
    }
    
    // Validate safety protocols
    if (!caseData.clinical_dossier?.safety_protocols) {
      warnings.push('Safety protocols section is recommended for laboratory cases');
    }
    
    // Check for required fields in specimen information
    const specimenInfo = caseData.clinical_dossier?.specimen_information;
    if (specimenInfo) {
      if (!specimenInfo.specimen_type) {
        errors.push('Specimen type is required');
      }
      if (!specimenInfo.collection_method) {
        warnings.push('Collection method is recommended');
      }
    }
    
    // Check test requests
    const testRequests = caseData.clinical_dossier?.test_requests;
    if (testRequests && (!testRequests.ordered_tests || testRequests.ordered_tests.length === 0)) {
      errors.push('At least one test must be ordered');
    }
  }

  validateRadiologyCase(caseData, errors, warnings) {
    if (!caseData.clinical_dossier?.imaging_study) {
      errors.push('Radiology cases require imaging study information');
    }
    if (!caseData.patient_persona?.clinical_question) {
      warnings.push('Clinical question is recommended for radiology cases');
    }
  }

  validatePharmacyCase(caseData, errors, warnings) {
    if (!caseData.clinical_dossier?.medication_history) {
      errors.push('Pharmacy cases require medication history');
    }
    if (!caseData.clinical_dossier?.prescription_review) {
      warnings.push('Prescription review is recommended for pharmacy cases');
    }
  }

  /**
   * Merge custom data into template
   */
  mergeCustomData(template, customData) {
    Object.keys(customData).forEach(key => {
      if (typeof customData[key] === 'object' && customData[key] !== null && !Array.isArray(customData[key])) {
        if (!template[key]) template[key] = {};
        this.mergeCustomData(template[key], customData[key]);
      } else {
        template[key] = customData[key];
      }
    });
  }

  /**
   * Generate unique case ID
   */
  generateCaseId(discipline) {
    const prefix = discipline.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Get template fields for a discipline
   * @param {string} discipline - Healthcare discipline
   * @returns {Object} - Template field structure
   */
  getTemplateFields(discipline) {
    const template = this.getTemplate(discipline);
    return this.extractFieldStructure(template.template);
  }

  /**
   * Extract field structure from template
   */
  extractFieldStructure(obj, path = '') {
    const fields = {};
    
    Object.keys(obj).forEach(key => {
      const fullPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        fields[fullPath] = {
          type: typeof value,
          required: value !== null && value !== '',
          example: value
        };
      } else if (Array.isArray(value)) {
        fields[fullPath] = {
          type: 'array',
          required: false,
          example: value
        };
      } else if (typeof value === 'object') {
        Object.assign(fields, this.extractFieldStructure(value, fullPath));
      }
    });
    
    return fields;
  }

  /**
   * Get template statistics
   * @returns {Object} - Template usage statistics
   */
  getTemplateStatistics() {
    return {
      totalTemplates: Object.keys(this.templates).length,
      disciplines: Object.keys(this.templates),
      templateSizes: Object.keys(this.templates).reduce((sizes, discipline) => {
        sizes[discipline] = JSON.stringify(this.templates[discipline]).length;
        return sizes;
      }, {}),
      lastUpdated: new Date().toISOString()
    };
  }
}

export default new CaseTemplateService();
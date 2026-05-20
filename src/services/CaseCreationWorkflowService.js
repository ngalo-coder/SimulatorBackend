import Case from '../models/CaseModel.js';
import User from '../models/UserModel.js';
import caseTemplateService from './CaseTemplateService.js';
import auditLogger from './AuditLoggerService.js';
import mongoose from 'mongoose';

/**
 * Case Creation Workflow Service
 * Provides guided case creation workflow with template selection, validation,
 * draft saving, collaborative editing, and rich text support
 */
class CaseCreationWorkflowService {
  constructor() {
    this.workflowSteps = {
      TEMPLATE_SELECTION: 'template_selection',
      BASIC_INFO: 'basic_info',
      PATIENT_PERSONA: 'patient_persona',
      CLINICAL_DOSSIER: 'clinical_dossier',
      EVALUATION_CRITERIA: 'evaluation_criteria',
      REVIEW_SUBMIT: 'review_submit'
    };

    this.draftStatuses = {
      CREATED: 'created',
      IN_PROGRESS: 'in_progress',
      READY_FOR_REVIEW: 'ready_for_review',
      SUBMITTED: 'submitted'
    };

    this.medicalTerminology = {
      common_terms: [
        'acute', 'chronic', 'diagnosis', 'prognosis', 'symptom', 'syndrome',
        'pathology', 'etiology', 'differential', 'treatment', 'therapy',
        'medication', 'dosage', 'contraindication', 'adverse', 'reaction'
      ],
      medical_specialties: [
        'cardiology', 'neurology', 'oncology', 'pediatrics', 'geriatrics',
        'psychiatry', 'dermatology', 'orthopedics', 'ophthalmology', 'ENT'
      ],
      body_systems: [
        'cardiovascular', 'respiratory', 'gastrointestinal', 'neurological',
        'musculoskeletal', 'endocrine', 'genitourinary', 'integumentary'
      ]
    };
  }

  /**
   * Initialize case creation workflow
   * @param {Object} user - User creating the case
   * @param {string} discipline - Healthcare discipline
   * @returns {Promise<Object>} - Workflow initialization data
   */
  async initializeWorkflow(user, discipline) {
    try {
      // Get template for the discipline
      const template = caseTemplateService.getTemplate(discipline);
      
      // Create initial draft
      const draftId = new mongoose.Types.ObjectId();
      const draft = {
        _id: draftId,
        createdBy: user._id,
        discipline: discipline,
        status: this.draftStatuses.CREATED,
        currentStep: this.workflowSteps.TEMPLATE_SELECTION,
        template: template.template,
        caseData: this.initializeEmptyCaseData(template.template),
        collaborators: [{
          user: user._id,
          role: 'owner',
          permissions: ['read', 'write', 'delete', 'share'],
          addedAt: new Date()
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date()
      };

      // Save draft to database
      await mongoose.connection.db.collection('case_drafts').insertOne(draft);

      // Log workflow initialization
      await auditLogger.logAuthEvent({
        event: 'CASE_WORKFLOW_INITIALIZED',
        userId: user._id,
        username: user.username,
        metadata: {
          draftId: draftId,
          discipline: discipline,
          step: this.workflowSteps.TEMPLATE_SELECTION
        }
      });

      return {
        draftId: draftId,
        discipline: discipline,
        template: template,
        currentStep: this.workflowSteps.TEMPLATE_SELECTION,
        workflowSteps: this.getWorkflowSteps(discipline),
        caseData: draft.caseData,
        status: this.draftStatuses.CREATED
      };
    } catch (error) {
      console.error('Initialize workflow error:', error);
      throw error;
    }
  }

  /**
   * Get workflow steps for discipline
   * @param {string} discipline - Healthcare discipline
   * @returns {Array} - Workflow steps with metadata
   */
  getWorkflowSteps(discipline) {
    const baseSteps = [
      {
        id: this.workflowSteps.TEMPLATE_SELECTION,
        name: 'Template Selection',
        description: 'Choose and customize your case template',
        icon: 'clipboard-list',
        required: true,
        estimatedTime: 5
      },
      {
        id: this.workflowSteps.BASIC_INFO,
        name: 'Basic Information',
        description: 'Set case title, difficulty, and learning objectives',
        icon: 'info-circle',
        required: true,
        estimatedTime: 10
      },
      {
        id: this.workflowSteps.PATIENT_PERSONA,
        name: 'Patient Information',
        description: 'Define patient demographics and presentation',
        icon: 'user',
        required: true,
        estimatedTime: 15
      },
      {
        id: this.workflowSteps.CLINICAL_DOSSIER,
        name: 'Clinical Content',
        description: 'Add clinical information and case details',
        icon: 'file-medical',
        required: true,
        estimatedTime: 30
      },
      {
        id: this.workflowSteps.EVALUATION_CRITERIA,
        name: 'Assessment Setup',
        description: 'Configure evaluation criteria and scoring',
        icon: 'chart-bar',
        required: false,
        estimatedTime: 10
      },
      {
        id: this.workflowSteps.REVIEW_SUBMIT,
        name: 'Review & Submit',
        description: 'Review your case and submit for approval',
        icon: 'check-circle',
        required: true,
        estimatedTime: 10
      }
    ];

    // Customize steps based on discipline
    if (discipline === 'nursing') {
      baseSteps[3].description = 'Add nursing assessment and care planning details';
    } else if (discipline === 'laboratory') {
      baseSteps[3].description = 'Add specimen and testing workflow details';
    } else if (discipline === 'radiology') {
      baseSteps[3].description = 'Add imaging study and interpretation details';
    } else if (discipline === 'pharmacy') {
      baseSteps[3].description = 'Add medication therapy and counseling details';
    }

    return baseSteps;
  }

  /**
   * Update workflow step
   * @param {string} draftId - Draft ID
   * @param {string} stepId - Step ID
   * @param {Object} stepData - Step data
   * @param {Object} user - User updating the step
   * @returns {Promise<Object>} - Updated workflow data
   */
  async updateWorkflowStep(draftId, stepId, stepData, user) {
    try {
      // Get current draft
      const draft = await mongoose.connection.db.collection('case_drafts')
        .findOne({ _id: new mongoose.Types.ObjectId(draftId) });

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Check permissions
      if (!this.canUserEditDraft(draft, user)) {
        throw new Error('Access denied');
      }

      // Validate step data
      const validation = await this.validateStepData(stepId, stepData, draft.discipline);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Update case data based on step
      const updatedCaseData = this.mergeStepData(draft.caseData, stepId, stepData);

      // Update draft
      const updateData = {
        caseData: updatedCaseData,
        currentStep: stepId,
        updatedAt: new Date(),
        lastActivity: new Date(),
        lastModifiedBy: user._id
      };

      // Update status if moving to final step
      if (stepId === this.workflowSteps.REVIEW_SUBMIT) {
        updateData.status = this.draftStatuses.READY_FOR_REVIEW;
      } else if (draft.status === this.draftStatuses.CREATED) {
        updateData.status = this.draftStatuses.IN_PROGRESS;
      }

      await mongoose.connection.db.collection('case_drafts')
        .updateOne(
          { _id: new mongoose.Types.ObjectId(draftId) },
          { $set: updateData }
        );

      // Log step update
      await auditLogger.logAuthEvent({
        event: 'CASE_WORKFLOW_STEP_UPDATED',
        userId: user._id,
        username: user.username,
        metadata: {
          draftId: draftId,
          step: stepId,
          discipline: draft.discipline
        }
      });

      return {
        success: true,
        draftId: draftId,
        currentStep: stepId,
        caseData: updatedCaseData,
        status: updateData.status,
        validation: validation
      };
    } catch (error) {
      console.error('Update workflow step error:', error);
      throw error;
    }
  }

  /**
   * Get draft by ID
   * @param {string} draftId - Draft ID
   * @param {Object} user - User requesting the draft
   * @returns {Promise<Object>} - Draft data
   */
  async getDraft(draftId, user) {
    try {
      const draft = await mongoose.connection.db.collection('case_drafts')
        .findOne({ _id: new mongoose.Types.ObjectId(draftId) });

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Check permissions
      if (!this.canUserAccessDraft(draft, user)) {
        throw new Error('Access denied');
      }

      // Get template information
      const template = caseTemplateService.getTemplate(draft.discipline);

      // Get workflow steps
      const workflowSteps = this.getWorkflowSteps(draft.discipline);

      // Calculate completion percentage
      const completionPercentage = this.calculateCompletionPercentage(draft.caseData, template.template);

      return {
        draftId: draft._id,
        discipline: draft.discipline,
        status: draft.status,
        currentStep: draft.currentStep,
        caseData: draft.caseData,
        template: template,
        workflowSteps: workflowSteps,
        collaborators: draft.collaborators,
        completionPercentage: completionPercentage,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        lastActivity: draft.lastActivity
      };
    } catch (error) {
      console.error('Get draft error:', error);
      throw error;
    }
  }

  /**
   * Save draft
   * @param {string} draftId - Draft ID
   * @param {Object} caseData - Case data to save
   * @param {Object} user - User saving the draft
   * @returns {Promise<Object>} - Save result
   */
  async saveDraft(draftId, caseData, user) {
    try {
      const draft = await mongoose.connection.db.collection('case_drafts')
        .findOne({ _id: new mongoose.Types.ObjectId(draftId) });

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Check permissions
      if (!this.canUserEditDraft(draft, user)) {
        throw new Error('Access denied');
      }

      // Validate case data
      const validation = caseTemplateService.validateCaseData(caseData, draft.discipline);

      // Update draft
      await mongoose.connection.db.collection('case_drafts')
        .updateOne(
          { _id: new mongoose.Types.ObjectId(draftId) },
          {
            $set: {
              caseData: caseData,
              updatedAt: new Date(),
              lastActivity: new Date(),
              lastModifiedBy: user._id
            }
          }
        );

      // Log draft save
      await auditLogger.logAuthEvent({
        event: 'CASE_DRAFT_SAVED',
        userId: user._id,
        username: user.username,
        metadata: {
          draftId: draftId,
          discipline: draft.discipline,
          isValid: validation.isValid
        }
      });

      return {
        success: true,
        draftId: draftId,
        validation: validation,
        savedAt: new Date()
      };
    } catch (error) {
      console.error('Save draft error:', error);
      throw error;
    }
  }

  /**
   * Submit case for review
   * @param {string} draftId - Draft ID
   * @param {Object} user - User submitting the case
   * @returns {Promise<Object>} - Submission result
   */
  async submitCaseForReview(draftId, user) {
    try {
      const draft = await mongoose.connection.db.collection('case_drafts')
        .findOne({ _id: new mongoose.Types.ObjectId(draftId) });

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Check permissions
      if (!this.canUserEditDraft(draft, user)) {
        throw new Error('Access denied');
      }

      // Validate case data
      const validation = caseTemplateService.validateCaseData(draft.caseData, draft.discipline);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Case validation failed',
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Create case from draft
      const caseData = {
        ...draft.caseData,
        createdBy: user._id,
        lastModifiedBy: user._id,
        status: 'pending_review',
        version: 1,
        versionHistory: [{
          version: 1,
          createdBy: user._id,
          createdAt: new Date(),
          changes: 'Initial case creation from workflow',
          status: 'pending_review'
        }],
        collaborators: draft.collaborators,
        createdFromDraft: draftId
      };

      const newCase = new Case(caseData);
      await newCase.save();

      // Update draft status
      await mongoose.connection.db.collection('case_drafts')
        .updateOne(
          { _id: new mongoose.Types.ObjectId(draftId) },
          {
            $set: {
              status: this.draftStatuses.SUBMITTED,
              submittedAt: new Date(),
              submittedBy: user._id,
              caseId: newCase._id
            }
          }
        );

      // Log case submission
      await auditLogger.logAuthEvent({
        event: 'CASE_SUBMITTED_FROM_WORKFLOW',
        userId: user._id,
        username: user.username,
        metadata: {
          draftId: draftId,
          caseId: newCase._id,
          discipline: draft.discipline,
          title: draft.caseData.case_metadata?.title
        }
      });

      return {
        success: true,
        caseId: newCase._id,
        draftId: draftId,
        message: 'Case submitted for review successfully'
      };
    } catch (error) {
      console.error('Submit case for review error:', error);
      throw error;
    }
  }

  /**
   * Add collaborator to draft
   * @param {string} draftId - Draft ID
   * @param {Object} collaboratorData - Collaborator data
   * @param {Object} user - User adding the collaborator
   * @returns {Promise<Object>} - Updated draft
   */
  async addCollaborator(draftId, collaboratorData, user) {
    try {
      const { userId, role, permissions } = collaboratorData;
      
      const draft = await mongoose.connection.db.collection('case_drafts')
        .findOne({ _id: new mongoose.Types.ObjectId(draftId) });

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Check permissions
      if (!this.canUserShareDraft(draft, user)) {
        throw new Error('Access denied');
      }

      // Check if user exists
      const collaboratorUser = await User.findById(userId);
      if (!collaboratorUser) {
        throw new Error('Collaborator user not found');
      }

      // Check if already a collaborator
      const existingCollaborator = draft.collaborators.find(
        collab => collab.user.toString() === userId
      );

      let updatedCollaborators;
      if (existingCollaborator) {
        // Update existing collaborator
        updatedCollaborators = draft.collaborators.map(collab => 
          collab.user.toString() === userId 
            ? { ...collab, role, permissions, updatedAt: new Date() }
            : collab
        );
      } else {
        // Add new collaborator
        updatedCollaborators = [
          ...draft.collaborators,
          {
            user: new mongoose.Types.ObjectId(userId),
            role: role,
            permissions: permissions,
            addedBy: user._id,
            addedAt: new Date()
          }
        ];
      }

      // Update draft
      await mongoose.connection.db.collection('case_drafts')
        .updateOne(
          { _id: new mongoose.Types.ObjectId(draftId) },
          {
            $set: {
              collaborators: updatedCollaborators,
              updatedAt: new Date(),
              lastActivity: new Date()
            }
          }
        );

      // Log collaboration
      await auditLogger.logAuthEvent({
        event: 'CASE_DRAFT_COLLABORATOR_ADDED',
        userId: user._id,
        username: user.username,
        metadata: {
          draftId: draftId,
          collaboratorId: userId,
          collaboratorUsername: collaboratorUser.username,
          role: role
        }
      });

      return {
        success: true,
        draftId: draftId,
        collaborators: updatedCollaborators
      };
    } catch (error) {
      console.error('Add collaborator error:', error);
      throw error;
    }
  }  /*
*
   * Get user's drafts
   * @param {Object} user - User requesting drafts
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - User's drafts
   */
  async getUserDrafts(user, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status = 'all',
        discipline = 'all'
      } = options;

      // Build query
      const query = {
        $or: [
          { createdBy: user._id },
          { 'collaborators.user': user._id }
        ]
      };

      if (status !== 'all') {
        query.status = status;
      }

      if (discipline !== 'all') {
        query.discipline = discipline;
      }

      // Pagination
      const pageSize = Math.min(parseInt(limit), 50);
      const skip = (parseInt(page) - 1) * pageSize;

      // Execute queries
      const [drafts, total] = await Promise.all([
        mongoose.connection.db.collection('case_drafts')
          .find(query)
          .sort({ lastActivity: -1 })
          .skip(skip)
          .limit(pageSize)
          .toArray(),
        mongoose.connection.db.collection('case_drafts')
          .countDocuments(query)
      ]);

      // Enhance drafts with additional information
      const enhancedDrafts = await Promise.all(
        drafts.map(async (draft) => {
          const template = caseTemplateService.getTemplate(draft.discipline);
          const completionPercentage = this.calculateCompletionPercentage(draft.caseData, template.template);
          
          return {
            draftId: draft._id,
            discipline: draft.discipline,
            status: draft.status,
            currentStep: draft.currentStep,
            title: draft.caseData?.case_metadata?.title || 'Untitled Case',
            completionPercentage: completionPercentage,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
            lastActivity: draft.lastActivity,
            collaborators: draft.collaborators?.length || 0
          };
        })
      );

      return {
        drafts: enhancedDrafts,
        pagination: {
          page: parseInt(page),
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: skip + pageSize < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Get user drafts error:', error);
      throw error;
    }
  }

  /**
   * Delete draft
   * @param {string} draftId - Draft ID
   * @param {Object} user - User deleting the draft
   * @returns {Promise<boolean>} - Success status
   */
  async deleteDraft(draftId, user) {
    try {
      const draft = await mongoose.connection.db.collection('case_drafts')
        .findOne({ _id: new mongoose.Types.ObjectId(draftId) });

      if (!draft) {
        throw new Error('Draft not found');
      }

      // Check permissions
      if (!this.canUserDeleteDraft(draft, user)) {
        throw new Error('Access denied');
      }

      // Delete draft
      await mongoose.connection.db.collection('case_drafts')
        .deleteOne({ _id: new mongoose.Types.ObjectId(draftId) });

      // Log draft deletion
      await auditLogger.logAuthEvent({
        event: 'CASE_DRAFT_DELETED',
        userId: user._id,
        username: user.username,
        metadata: {
          draftId: draftId,
          discipline: draft.discipline,
          title: draft.caseData?.case_metadata?.title
        }
      });

      return true;
    } catch (error) {
      console.error('Delete draft error:', error);
      throw error;
    }
  }

  /**
   * Get medical terminology suggestions
   * @param {string} query - Search query
   * @param {string} category - Category filter
   * @returns {Array} - Terminology suggestions
   */
  getTerminologySuggestions(query = '', category = 'all') {
    const searchTerm = query.toLowerCase();
    let terms = [];

    if (category === 'all' || category === 'common') {
      terms = terms.concat(this.medicalTerminology.common_terms);
    }
    if (category === 'all' || category === 'specialties') {
      terms = terms.concat(this.medicalTerminology.medical_specialties);
    }
    if (category === 'all' || category === 'systems') {
      terms = terms.concat(this.medicalTerminology.body_systems);
    }

    // Filter and sort by relevance
    const filtered = terms
      .filter(term => term.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aIndex = a.toLowerCase().indexOf(searchTerm);
        const bIndex = b.toLowerCase().indexOf(searchTerm);
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.length - b.length;
      })
      .slice(0, 10);

    return filtered.map(term => ({
      term: term,
      category: this.getTermCategory(term),
      definition: this.getTermDefinition(term)
    }));
  }

  // Helper methods

  /**
   * Initialize empty case data from template
   */
  initializeEmptyCaseData(template) {
    const caseData = JSON.parse(JSON.stringify(template));
    
    // Clear all values but keep structure
    this.clearTemplateValues(caseData);
    
    return caseData;
  }

  /**
   * Clear template values recursively
   */
  clearTemplateValues(obj) {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (typeof value === 'string') {
        obj[key] = '';
      } else if (typeof value === 'number') {
        obj[key] = null;
      } else if (Array.isArray(value)) {
        obj[key] = [];
      } else if (typeof value === 'object' && value !== null) {
        this.clearTemplateValues(value);
      }
    });
  }

  /**
   * Merge step data into case data
   */
  mergeStepData(caseData, stepId, stepData) {
    const updatedCaseData = JSON.parse(JSON.stringify(caseData));
    
    switch (stepId) {
      case this.workflowSteps.BASIC_INFO:
        if (stepData.case_metadata) {
          updatedCaseData.case_metadata = {
            ...updatedCaseData.case_metadata,
            ...stepData.case_metadata
          };
        }
        if (stepData.description) {
          updatedCaseData.description = stepData.description;
        }
        break;
        
      case this.workflowSteps.PATIENT_PERSONA:
        if (stepData.patient_persona) {
          updatedCaseData.patient_persona = {
            ...updatedCaseData.patient_persona,
            ...stepData.patient_persona
          };
        }
        break;
        
      case this.workflowSteps.CLINICAL_DOSSIER:
        if (stepData.clinical_dossier) {
          updatedCaseData.clinical_dossier = {
            ...updatedCaseData.clinical_dossier,
            ...stepData.clinical_dossier
          };
        }
        break;
        
      case this.workflowSteps.EVALUATION_CRITERIA:
        if (stepData.evaluation_criteria) {
          updatedCaseData.evaluation_criteria = {
            ...updatedCaseData.evaluation_criteria,
            ...stepData.evaluation_criteria
          };
        }
        break;
        
      default:
        // For other steps, merge all provided data
        Object.keys(stepData).forEach(key => {
          if (typeof stepData[key] === 'object' && stepData[key] !== null && !Array.isArray(stepData[key])) {
            updatedCaseData[key] = {
              ...updatedCaseData[key],
              ...stepData[key]
            };
          } else {
            updatedCaseData[key] = stepData[key];
          }
        });
    }
    
    return updatedCaseData;
  }

  /**
   * Validate step data
   */
  async validateStepData(stepId, stepData, discipline) {
    const errors = [];
    const warnings = [];

    switch (stepId) {
      case this.workflowSteps.BASIC_INFO:
        if (!stepData.case_metadata?.title) {
          errors.push('Case title is required');
        }
        if (!stepData.case_metadata?.difficulty) {
          errors.push('Difficulty level is required');
        }
        if (stepData.case_metadata?.estimated_duration && 
            (stepData.case_metadata.estimated_duration < 5 || stepData.case_metadata.estimated_duration > 180)) {
          warnings.push('Estimated duration should be between 5 and 180 minutes');
        }
        break;
        
      case this.workflowSteps.PATIENT_PERSONA:
        if (!stepData.patient_persona?.name) {
          errors.push('Patient name is required');
        }
        if (!stepData.patient_persona?.age) {
          errors.push('Patient age is required');
        }
        if (stepData.patient_persona?.age && 
            (stepData.patient_persona.age < 0 || stepData.patient_persona.age > 120)) {
          errors.push('Patient age must be between 0 and 120');
        }
        break;
        
      case this.workflowSteps.CLINICAL_DOSSIER:
        // Discipline-specific validation
        if (discipline === 'medicine' && !stepData.clinical_dossier?.hidden_diagnosis) {
          errors.push('Hidden diagnosis is required for medical cases');
        }
        if (discipline === 'nursing' && !stepData.clinical_dossier?.nursing_assessment) {
          warnings.push('Nursing assessment is recommended');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate completion percentage
   */
  calculateCompletionPercentage(caseData, template) {
    let totalFields = 0;
    let completedFields = 0;

    this.countFields(template, caseData, (templateValue, caseValue) => {
      totalFields++;
      if (this.isFieldCompleted(templateValue, caseValue)) {
        completedFields++;
      }
    });

    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  }

  /**
   * Count fields recursively
   */
  countFields(template, caseData, callback) {
    Object.keys(template).forEach(key => {
      const templateValue = template[key];
      const caseValue = caseData[key];

      if (typeof templateValue === 'string' || typeof templateValue === 'number' || templateValue === null) {
        callback(templateValue, caseValue);
      } else if (Array.isArray(templateValue)) {
        callback(templateValue, caseValue);
      } else if (typeof templateValue === 'object' && templateValue !== null) {
        if (caseValue && typeof caseValue === 'object') {
          this.countFields(templateValue, caseValue, callback);
        } else {
          this.countFields(templateValue, {}, callback);
        }
      }
    });
  }

  /**
   * Check if field is completed
   */
  isFieldCompleted(templateValue, caseValue) {
    if (caseValue === null || caseValue === undefined) return false;
    if (typeof caseValue === 'string') return caseValue.trim() !== '';
    if (typeof caseValue === 'number') return true;
    if (Array.isArray(caseValue)) return caseValue.length > 0;
    return true;
  }

  /**
   * Permission checking methods
   */
  canUserAccessDraft(draft, user) {
    if (user.primaryRole === 'admin') return true;
    if (draft.createdBy.toString() === user._id.toString()) return true;
    if (draft.collaborators && draft.collaborators.some(collab => collab.user.toString() === user._id.toString())) return true;
    return false;
  }

  canUserEditDraft(draft, user) {
    if (user.primaryRole === 'admin') return true;
    if (draft.createdBy.toString() === user._id.toString()) return true;
    if (draft.collaborators) {
      const collaborator = draft.collaborators.find(collab => collab.user.toString() === user._id.toString());
      if (collaborator && collaborator.permissions.includes('write')) return true;
    }
    return false;
  }

  canUserDeleteDraft(draft, user) {
    if (user.primaryRole === 'admin') return true;
    if (draft.createdBy.toString() === user._id.toString()) return true;
    if (draft.collaborators) {
      const collaborator = draft.collaborators.find(collab => collab.user.toString() === user._id.toString());
      if (collaborator && collaborator.permissions.includes('delete')) return true;
    }
    return false;
  }

  canUserShareDraft(draft, user) {
    if (user.primaryRole === 'admin') return true;
    if (draft.createdBy.toString() === user._id.toString()) return true;
    if (draft.collaborators) {
      const collaborator = draft.collaborators.find(collab => collab.user.toString() === user._id.toString());
      if (collaborator && collaborator.permissions.includes('share')) return true;
    }
    return false;
  }

  /**
   * Get term category
   */
  getTermCategory(term) {
    if (this.medicalTerminology.common_terms.includes(term)) return 'common';
    if (this.medicalTerminology.medical_specialties.includes(term)) return 'specialty';
    if (this.medicalTerminology.body_systems.includes(term)) return 'system';
    return 'general';
  }

  /**
   * Get term definition (simplified - in real implementation would use medical dictionary)
   */
  getTermDefinition(term) {
    const definitions = {
      'acute': 'Sudden onset or short duration',
      'chronic': 'Long-term or persistent condition',
      'diagnosis': 'Identification of a disease or condition',
      'prognosis': 'Expected course and outcome of a disease',
      'cardiology': 'Medical specialty dealing with heart disorders',
      'neurology': 'Medical specialty dealing with nervous system disorders'
    };
    
    return definitions[term] || 'Medical term';
  }
}

export default new CaseCreationWorkflowService();
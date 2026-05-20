import CompetencyAssessment from '../models/CompetencyAssessmentModel.js';
import LearningPath from '../models/LearningPathModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import AnalyticsService from './AnalyticsService.js';
import CaseModel from '../models/CaseModel.js';

class CompetencyAssessmentService {
  // Initialize competency assessment for a user
  async initializeUserAssessment(userId) {
    try {
      // Check if assessment already exists
      const existingAssessment = await CompetencyAssessment.findOne({ userId });
      if (existingAssessment) {
        return existingAssessment;
      }

      // Create default competency assessment with standard frameworks
      const defaultAssessment = new CompetencyAssessment({
        userId,
        professionalStandards: this._getDefaultProfessionalStandards(),
        competencies: this._getDefaultCompetencies(),
        settings: {
          autoSyncExternal: false,
          portfolioVisibility: 'private',
          assessmentReminders: true,
          certificationAlerts: true
        }
      });

      await defaultAssessment.save();
      return defaultAssessment;
    } catch (error) {
      throw new Error(`Failed to initialize competency assessment: ${error.message}`);
    }
  }

  // Get competency assessment for a user
  async getUserAssessment(userId) {
    try {
      const assessment = await CompetencyAssessment.findOne({ userId })
        .populate('assessments.evidence.referenceId', 'title case_metadata')
        .populate('portfolio.verification.verifiedBy', 'name email');

      if (!assessment) {
        return await this.initializeUserAssessment(userId);
      }

      return assessment;
    } catch (error) {
      throw new Error(`Failed to get user assessment: ${error.message}`);
    }
  }

  // Update competency levels based on performance
  async updateCompetencyLevels(userId, performanceData = null) {
    try {
      const assessment = await this.getUserAssessment(userId);
      
      if (!performanceData) {
        // Get performance data from analytics
        performanceData = await AnalyticsService.getWeakAreas(userId);
      }

      // Update competency levels based on performance
      assessment.competencies.forEach(competency => {
        const performance = performanceData.find(p => 
          this._mapCompetencyToPerformanceArea(competency.competencyName) === p.name
        );
        
        if (performance) {
          competency.confidenceScore = performance.score;
          competency.currentLevel = this._scoreToLevel(performance.score);
          competency.lastAssessed = new Date();
        }
      });

      await assessment.save();
      return assessment;
    } catch (error) {
      throw new Error(`Failed to update competency levels: ${error.message}`);
    }
  }

  // Add assessment result
  async addAssessmentResult(userId, assessmentData) {
    try {
      const assessment = await this.getUserAssessment(userId);
      
      assessment.assessments.push({
        ...assessmentData,
        completedAt: new Date()
      });

      // Update competency levels based on assessment result
      if (assessmentData.competencyArea && assessmentData.score) {
        this._updateCompetencyFromAssessment(assessment, assessmentData.competencyArea, assessmentData.score);
      }

      await assessment.save();
      return assessment;
    } catch (error) {
      throw new Error(`Failed to add assessment result: ${error.message}`);
    }
  }

  // Add portfolio item
  async addPortfolioItem(userId, portfolioData) {
    try {
      const assessment = await this.getUserAssessment(userId);
      
      portfolioData.itemId = this._generatePortfolioId();
      assessment.portfolio.push(portfolioData);

      await assessment.save();
      return assessment;
    } catch (error) {
      throw new Error(`Failed to add portfolio item: ${error.message}`);
    }
  }

  // Check certification requirements
  async checkCertificationRequirements(userId, certificationId) {
    try {
      const assessment = await this.getUserAssessment(userId);
      const certification = assessment.certifications.id(certificationId);
      
      if (!certification) {
        throw new Error('Certification not found');
      }

      // Check each requirement
      certification.requirements.forEach(requirement => {
        const isMet = this._checkRequirement(assessment, requirement);
        requirement.status = isMet ? 'met' : 'not_met';
        if (isMet && !requirement.metAt) {
          requirement.metAt = new Date();
        }
      });

      // Update certification status
      const allRequirementsMet = certification.requirements.every(req => req.status === 'met');
      certification.status = allRequirementsMet ? 'eligible' : 'not_met';

      await assessment.save();
      return certification;
    } catch (error) {
      throw new Error(`Failed to check certification requirements: ${error.message}`);
    }
  }

  // Sync external assessment results
  async syncExternalAssessment(userId, externalData) {
    try {
      const assessment = await this.getUserAssessment(userId);
      
      assessment.externalAssessments.push({
        ...externalData,
        syncStatus: 'synced',
        lastSynced: new Date()
      });

      // Update competencies from external assessment if applicable
      if (externalData.competencyArea && externalData.score) {
        this._updateCompetencyFromAssessment(assessment, externalData.competencyArea, externalData.score);
      }

      await assessment.save();
      return assessment;
    } catch (error) {
      throw new Error(`Failed to sync external assessment: ${error.message}`);
    }
  }

  // Generate competency report
  async generateCompetencyReport(userId) {
    try {
      const assessment = await this.getUserAssessment(userId);
      
      const report = {
        userId,
        generatedAt: new Date(),
        overallScore: assessment.overallCompetencyScore,
        competencyBreakdown: assessment.competencies.map(comp => ({
          competency: comp.competencyName,
          area: comp.area,
          currentLevel: comp.currentLevel,
          targetLevel: comp.targetLevel,
          confidenceScore: comp.confidenceScore,
          lastAssessed: comp.lastAssessed
        })),
        certificationStatus: assessment.certifications.map(cert => ({
          title: cert.title,
          status: cert.status,
          requirementsMet: cert.requirements.filter(req => req.status === 'met').length,
          totalRequirements: cert.requirements.length
        })),
        recentAssessments: assessment.assessments
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .slice(0, 5)
          .map(assess => ({
            title: assess.title,
            type: assess.type,
            score: assess.score,
            status: assess.status,
            completedAt: assess.completedAt
          })),
        recommendations: this._generateRecommendations(assessment)
      };

      return report;
    } catch (error) {
      throw new Error(`Failed to generate competency report: ${error.message}`);
    }
  }

  // Private helper methods
  _getDefaultProfessionalStandards() {
    return [
      {
        standardId: 'MCF-2024',
        standardName: 'Medical Competency Framework 2024',
        version: '1.0',
        issuingBody: 'International Medical Education Board',
        applicableSpecialties: ['general_medicine', 'surgery', 'pediatrics', 'emergency'],
        requirements: [
          {
            requirementId: 'MCF-CS-001',
            description: 'Clinical history taking and physical examination',
            competencyArea: 'clinical_skills',
            requiredLevel: 'intermediate',
            evidenceTypes: ['case_completion', 'assessment']
          },
          {
            requirementId: 'MCF-KN-001',
            description: 'Medical knowledge and diagnostic reasoning',
            competencyArea: 'knowledge',
            requiredLevel: 'intermediate',
            evidenceTypes: ['assessment', 'portfolio']
          }
        ]
      }
    ];
  }

  _getDefaultCompetencies() {
    return [
      {
        competencyId: 'CS-HISTORY',
        competencyName: 'History Taking',
        area: 'clinical_skills',
        currentLevel: 'beginner',
        targetLevel: 'intermediate',
        confidenceScore: 0
      },
      {
        competencyId: 'CS-DIAGNOSIS',
        competencyName: 'Diagnostic Reasoning',
        area: 'clinical_skills',
        currentLevel: 'beginner',
        targetLevel: 'intermediate',
        confidenceScore: 0
      },
      {
        competencyId: 'KN-MEDICAL',
        competencyName: 'Medical Knowledge',
        area: 'knowledge',
        currentLevel: 'beginner',
        targetLevel: 'intermediate',
        confidenceScore: 0
      },
      {
        competencyId: 'COM-PATIENT',
        competencyName: 'Patient Communication',
        area: 'communication',
        currentLevel: 'beginner',
        targetLevel: 'intermediate',
        confidenceScore: 0
      },
      {
        competencyId: 'PRO-PROFESSIONAL',
        competencyName: 'Professionalism',
        area: 'professional',
        currentLevel: 'beginner',
        targetLevel: 'intermediate',
        confidenceScore: 0
      }
    ];
  }

  _mapCompetencyToPerformanceArea(competencyName) {
    const mapping = {
      'History Taking': 'History Taking',
      'Diagnostic Reasoning': 'Differential Diagnosis',
      'Medical Knowledge': 'Differential Diagnosis',
      'Patient Communication': 'Communication & Empathy',
      'Professionalism': 'Overall Performance'
    };
    
    return mapping[competencyName] || competencyName;
  }

  _scoreToLevel(score) {
    if (score >= 85) return 'expert';
    if (score >= 70) return 'advanced';
    if (score >= 60) return 'intermediate';
    return 'beginner';
  }

  _updateCompetencyFromAssessment(assessment, competencyArea, score) {
    const competency = assessment.competencies.find(comp => 
      comp.area === competencyArea || comp.competencyName.toLowerCase().includes(competencyArea.toLowerCase())
    );
    
    if (competency) {
      competency.confidenceScore = Math.max(competency.confidenceScore, score);
      competency.currentLevel = this._scoreToLevel(competency.confidenceScore);
      competency.lastAssessed = new Date();
    }
  }

  _checkRequirement(assessment, requirement) {
    switch (requirement.evidenceTypes[0]) {
      case 'case_completion':
        return this._checkCaseCompletionRequirement(assessment, requirement);
      case 'assessment':
        return this._checkAssessmentRequirement(assessment, requirement);
      case 'portfolio':
        return this._checkPortfolioRequirement(assessment, requirement);
      default:
        return false;
    }
  }

  _checkCaseCompletionRequirement(assessment, requirement) {
    // Check if user has completed cases with sufficient scores in this competency area
    // This would integrate with actual case completion data
    return Math.random() > 0.3; // Placeholder logic
  }

  _checkAssessmentRequirement(assessment, requirement) {
    // Check assessment results for this competency area
    const relevantAssessments = assessment.assessments.filter(assess =>
      assess.competencyArea === requirement.competencyArea &&
      assess.score >= 70
    );
    
    return relevantAssessments.length > 0;
  }

  _checkPortfolioRequirement(assessment, requirement) {
    // Check portfolio items for this competency area
    const relevantPortfolioItems = assessment.portfolio.filter(item =>
      item.competencyAreas.includes(requirement.competencyArea) &&
      item.verification.verified
    );
    
    return relevantPortfolioItems.length > 0;
  }

  _generatePortfolioId() {
    return `PORT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateRecommendations(assessment) {
    const recommendations = [];
    
    // Recommend assessments for low-scoring competencies
    assessment.competencies
      .filter(comp => comp.confidenceScore < 60)
      .forEach(comp => {
        recommendations.push({
          type: 'assessment',
          competency: comp.competencyName,
          message: `Consider taking an assessment to improve your ${comp.competencyName} skills`,
          priority: 'high'
        });
      });

    // Recommend portfolio development
    if (assessment.portfolio.length < 3) {
      recommendations.push({
        type: 'portfolio',
        message: 'Build your portfolio with at least 3 items to showcase your competencies',
        priority: 'medium'
      });
    }

    // Certification recommendations
    assessment.certifications
      .filter(cert => cert.status === 'eligible')
      .forEach(cert => {
        recommendations.push({
          type: 'certification',
          certification: cert.title,
          message: `You are eligible for ${cert.title} certification`,
          priority: 'high'
        });
      });

    return recommendations;
  }
}

export default new CompetencyAssessmentService();
import LearningPath from '../models/LearningPathModel.js';
import CaseModel from '../models/CaseModel.js';
import CompetencyAssessmentService from './CompetencyAssessmentService.js';
import AnalyticsService from './AnalyticsService.js';

class LearningPathService {
  // Create a new learning path for a user
  async createLearningPath(userId, pathData) {
    try {
      const learningPath = new LearningPath({
        userId,
        ...pathData,
        status: 'active',
        startDate: new Date()
      });

      await learningPath.save();
      return learningPath;
    } catch (error) {
      throw new Error(`Failed to create learning path: ${error.message}`);
    }
  }

  // Generate an adaptive learning path based on user competencies and goals
  async generateAdaptiveLearningPath(userId, options = {}) {
    try {
      const { specialty, programArea, targetLevel = 'intermediate' } = options;

      // Get user competency assessment
      const assessment = await CompetencyAssessmentService.getUserAssessment(userId);
      
      // Get performance data to identify weak areas
      const performanceData = await AnalyticsService.getWeakAreas(userId);

      // Get available cases based on specialty and program area
      const cases = await this._getAvailableCases(specialty, programArea);

      // Structure modules based on competencies and performance
      const modules = this._structureModules(cases, assessment, performanceData, targetLevel);

      // Create learning path
      const learningPath = await this.createLearningPath(userId, {
        title: `Adaptive Learning Path for ${specialty}`,
        description: `Personalized learning path generated based on your competencies and performance in ${specialty}`,
        specialty,
        programArea,
        learningObjectives: this._generateLearningObjectives(assessment, targetLevel),
        modules,
        adaptiveSettings: {
          difficultyAdjustment: true,
          pacing: 'self-paced',
          feedbackFrequency: 'medium'
        }
      });

      return learningPath;
    } catch (error) {
      throw new Error(`Failed to generate adaptive learning path: ${error.message}`);
    }
  }

  // Get learning paths for a user
  async getLearningPaths(userId, filters = {}) {
    try {
      const query = { userId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.specialty) {
        query.specialty = filters.specialty;
      }
      if (filters.programArea) {
        query.programArea = filters.programArea;
      }

      const paths = await LearningPath.find(query)
        .sort({ createdAt: -1 })
        .populate('modules.moduleId', 'title case_metadata difficulty')
        .populate('completedModules.moduleId', 'title case_metadata');

      return paths;
    } catch (error) {
      throw new Error(`Failed to get learning paths: ${error.message}`);
    }
  }

  // Get a specific learning path
  async getLearningPath(pathId, userId) {
    try {
      const path = await LearningPath.findOne({ _id: pathId, userId })
        .populate('modules.moduleId', 'title case_metadata difficulty estimatedDuration')
        .populate('completedModules.moduleId', 'title case_metadata score timeSpent');

      if (!path) {
        throw new Error('Learning path not found');
      }

      return path;
    } catch (error) {
      throw new Error(`Failed to get learning path: ${error.message}`);
    }
  }

  // Update learning path progress
  async updatePathProgress(userId, pathId, moduleId, score, timeSpent) {
    try {
      const path = await this.getLearningPath(pathId, userId);
      
      // Add completed module
      path.addCompletedModule(moduleId, score, timeSpent);

      // Update current module index
      if (path.currentModuleIndex < path.modules.length - 1) {
        path.currentModuleIndex++;
      }

      await path.save();
      return path;
    } catch (error) {
      throw new Error(`Failed to update path progress: ${error.message}`);
    }
  }

  // Get next recommended module
  async getNextModule(userId, pathId) {
    try {
      const path = await this.getLearningPath(pathId, userId);
      const nextModule = path.getNextModule();

      if (!nextModule) {
        return { message: 'All modules completed', pathCompleted: true };
      }

      // Check if prerequisites are met
      const prerequisitesMet = path.checkPrerequisites(path.currentModuleIndex);
      
      if (!prerequisitesMet) {
        return { 
          message: 'Prerequisites not met for next module', 
          prerequisitesRequired: true,
          currentModule: path.modules[path.currentModuleIndex - 1] // Current completed module
        };
      }

      return {
        nextModule: nextModule,
        prerequisitesMet: true,
        pathProgress: path.overallProgress
      };
    } catch (error) {
      throw new Error(`Failed to get next module: ${error.message}`);
    }
  }

  // Adjust learning path difficulty based on performance
  async adjustPathDifficulty(userId, pathId, performanceData) {
    try {
      const path = await this.getLearningPath(pathId, userId);
      
      if (path.adaptiveSettings.difficultyAdjustment) {
        // Simple adjustment logic: if average score is high, increase difficulty; if low, decrease
        const averageScore = path.completedModules.reduce((sum, mod) => sum + mod.score, 0) / path.completedModules.length;
        
        if (averageScore > 80 && path.modules.length > path.currentModuleIndex) {
          // Increase difficulty for remaining modules
          path.modules.slice(path.currentModuleIndex).forEach(module => {
            module.difficulty = this._increaseDifficulty(module.difficulty);
          });
        } else if (averageScore < 60 && path.modules.length > path.currentModuleIndex) {
          // Decrease difficulty for remaining modules
          path.modules.slice(path.currentModuleIndex).forEach(module => {
            module.difficulty = this._decreaseDifficulty(module.difficulty);
          });
        }
      }

      await path.save();
      return path;
    } catch (error) {
      throw new Error(`Failed to adjust path difficulty: ${error.message}`);
    }
  }

  // Private helper methods
  async _getAvailableCases(specialty, programArea) {
    const query = {};
    
    if (specialty) {
      query['case_metadata.specialty'] = specialty;
    }
    if (programArea) {
      query['case_metadata.program_area'] = programArea;
    }

    const cases = await CaseModel.find(query)
      .select('title case_metadata difficulty estimatedDuration')
      .sort({ difficulty: 1, 'case_metadata.complexity': 1 });

    return cases;
  }

  _structureModules(cases, assessment, performanceData, targetLevel) {
    const modules = [];
    const competencyPriority = this._prioritizeCompetencies(assessment, performanceData);

    // Group cases by difficulty and map to modules
    const easyCases = cases.filter(c => c.case_metadata.difficulty === 'easy');
    const mediumCases = cases.filter(c => c.case_metadata.difficulty === 'medium');
    const hardCases = cases.filter(c => c.case_metadata.difficulty === 'hard');

    // Start with easy cases for beginner level
    if (targetLevel === 'beginner' || competencyPriority.includes('beginner')) {
      easyCases.forEach(caseItem => {
        modules.push({
          moduleId: caseItem._id,
          title: caseItem.title,
          type: 'case',
          difficulty: 'easy',
          estimatedDuration: caseItem.estimatedDuration || 30,
          prerequisites: [],
          learningObjectives: ['Build foundational knowledge and basic skills']
        });
      });
    }

    // Add medium cases for intermediate level
    if (targetLevel === 'intermediate' || competencyPriority.includes('intermediate')) {
      mediumCases.forEach(caseItem => {
        modules.push({
          moduleId: caseItem._id,
          title: caseItem.title,
          type: 'case',
          difficulty: 'medium',
          estimatedDuration: caseItem.estimatedDuration || 45,
          prerequisites: [{ moduleId: easyCases[0]?._id, requiredScore: 70 }], // Prerequisite from easy cases
          learningObjectives: ['Develop intermediate clinical reasoning and skills']
        });
      });
    }

    // Add hard cases for advanced level
    if (targetLevel === 'advanced' || competencyPriority.includes('advanced')) {
      hardCases.forEach(caseItem => {
        modules.push({
          moduleId: caseItem._id,
          title: caseItem.title,
          type: 'case',
          difficulty: 'hard',
          estimatedDuration: caseItem.estimatedDuration || 60,
          prerequisites: [{ moduleId: mediumCases[0]?._id, requiredScore: 75 }], // Prerequisite from medium cases
          learningObjectives: ['Master complex clinical scenarios and advanced skills']
        });
      });
    }

    return modules;
  }

  _prioritizeCompetencies(assessment, performanceData) {
    // Prioritize competencies based on performance data and assessment
    const weakAreas = performanceData.map(area => area.name);
    const lowCompetencies = assessment.competencies
      .filter(comp => comp.confidenceScore < 60)
      .map(comp => comp.competencyName);

    // Combine and prioritize
    const priorities = [...new Set([...weakAreas, ...lowCompetencies])];
    return priorities;
  }

  _generateLearningObjectives(assessment, targetLevel) {
    const objectives = [];
    
    assessment.competencies.forEach(comp => {
      if (comp.targetLevel === targetLevel || comp.confidenceScore < 60) {
        objectives.push({
          objective: `Achieve ${targetLevel} level in ${comp.competencyName}`,
          competencyArea: comp.area,
          targetLevel: targetLevel,
          alignedStandards: ['MCF-2024'] // Default standard
        });
      }
    });

    return objectives;
  }

  _increaseDifficulty(currentDifficulty) {
    const difficulties = ['easy', 'medium', 'hard', 'expert'];
    const currentIndex = difficulties.indexOf(currentDifficulty);
    return currentIndex < difficulties.length - 1 ? difficulties[currentIndex + 1] : currentDifficulty;
  }

  _decreaseDifficulty(currentDifficulty) {
    const difficulties = ['easy', 'medium', 'hard', 'expert'];
    const currentIndex = difficulties.indexOf(currentDifficulty);
    return currentIndex > 0 ? difficulties[currentIndex - 1] : currentDifficulty;
  }
}

export default new LearningPathService();
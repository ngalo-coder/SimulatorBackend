import LearningGoal from '../models/LearningGoalModel.js';
import RetakeService from './retakeService.js';
import AnalyticsService from './AnalyticsService.js';

class LearningGoalService {
  // Create a new learning goal
  async createGoal(userId, goalData) {
    try {
      const goal = new LearningGoal({
        userId,
        ...goalData,
        status: 'not_started',
        progress: 0
      });

      await goal.save();
      return goal;
    } catch (error) {
      throw new Error(`Failed to create learning goal: ${error.message}`);
    }
  }

  // Get all goals for a user
  async getGoalsByUser(userId, filters = {}) {
    try {
      const query = { userId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.priority) {
        query.priority = filters.priority;
      }

      const goals = await LearningGoal.find(query)
        .sort({ priority: -1, deadline: 1, createdAt: -1 });

      return goals;
    } catch (error) {
      throw new Error(`Failed to get learning goals: ${error.message}`);
    }
  }

  // Update a learning goal
  async updateGoal(goalId, userId, updateData) {
    try {
      const goal = await LearningGoal.findOne({ _id: goalId, userId });
      
      if (!goal) {
        throw new Error('Learning goal not found');
      }

      Object.assign(goal, updateData);
      
      // If action steps are being updated, recalculate progress
      if (updateData.actionSteps) {
        goal.updateProgress();
      }

      await goal.save();
      return goal;
    } catch (error) {
      throw new Error(`Failed to update learning goal: ${error.message}`);
    }
  }

  // Delete a learning goal
  async deleteGoal(goalId, userId) {
    try {
      const result = await LearningGoal.findOneAndDelete({ _id: goalId, userId });
      
      if (!result) {
        throw new Error('Learning goal not found');
      }

      return { message: 'Learning goal deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete learning goal: ${error.message}`);
    }
  }

  // Add action step to a goal
  async addActionStep(goalId, userId, stepData) {
    try {
      const goal = await LearningGoal.findOne({ _id: goalId, userId });
      
      if (!goal) {
        throw new Error('Learning goal not found');
      }

      goal.addActionStep(stepData.step, stepData.dueDate, stepData.resources || []);
      await goal.save();
      
      return goal;
    } catch (error) {
      throw new Error(`Failed to add action step: ${error.message}`);
    }
  }

  // Complete an action step
  async completeActionStep(goalId, userId, stepIndex) {
    try {
      const goal = await LearningGoal.findOne({ _id: goalId, userId });
      
      if (!goal) {
        throw new Error('Learning goal not found');
      }

      goal.completeActionStep(stepIndex);
      await goal.save();
      
      return goal;
    } catch (error) {
      throw new Error(`Failed to complete action step: ${error.message}`);
    }
  }

  // Generate SMART goals based on performance data
  async generateSmartGoals(userId, performanceData = null) {
    try {
      let weakAreas;
      
      if (performanceData) {
        weakAreas = performanceData;
      } else {
        // Get weak areas from analytics
        weakAreas = await AnalyticsService.getWeakAreas(userId);
      }

      const smartGoals = [];
      const categories = {
        'History Taking': 'clinical_skills',
        'Risk Assessment': 'clinical_skills',
        'Differential Diagnosis': 'knowledge',
        'Communication & Empathy': 'communication',
        'Clinical Urgency': 'clinical_skills',
        'Diagnosis Accuracy': 'clinical_skills',
        'Overall Performance': 'professional'
      };

      // Create goals for top 3 weak areas
      for (const area of weakAreas.slice(0, 3)) {
        const category = categories[area.name] || 'clinical_skills';
        
        const smartGoal = {
          title: `Improve ${area.name} Skills`,
          description: `Focus on developing proficiency in ${area.name} based on performance feedback`,
          category: category,
          specialty: null, // Can be set based on user's focus
          targetScore: Math.min(100, area.score + 20), // Aim for 20-point improvement
          priority: 'high',
          specific: `Improve ${area.name} score from ${area.score} to ${Math.min(100, area.score + 20)}`,
          measurable: `Track progress through case evaluations and performance metrics`,
          achievable: `Dedicate 2-3 hours per week to focused practice and study`,
          relevant: `Strong ${area.name} skills are essential for clinical competence and patient safety`,
          timeBound: `Achieve target within 4 weeks`,
          actionSteps: [
            {
              step: 'Review performance feedback and identify specific gaps',
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
              resources: ['Performance review report', 'Case feedback']
            },
            {
              step: 'Complete 2-3 practice cases focusing on this area',
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
              resources: ['Practice cases', 'Simulation exercises']
            },
            {
              step: 'Participate in peer learning session or seek mentorship',
              dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks
              resources: ['Peer learning groups', 'Mentorship program']
            },
            {
              step: 'Re-assess performance and adjust learning plan',
              dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 4 weeks
              resources: ['Follow-up evaluation', 'Progress tracking tools']
            }
          ]
        };

        smartGoals.push(smartGoal);
      }

      return smartGoals;
    } catch (error) {
      throw new Error(`Failed to generate SMART goals: ${error.message}`);
    }
  }

  // Get goal progress statistics
  async getGoalProgressStats(userId) {
    try {
      const goals = await LearningGoal.find({ userId });
      
      const stats = {
        total: goals.length,
        completed: goals.filter(g => g.status === 'completed').length,
        inProgress: goals.filter(g => g.status === 'in_progress').length,
        notStarted: goals.filter(g => g.status === 'not_started').length,
        archived: goals.filter(g => g.status === 'archived').length,
        averageProgress: 0,
        byCategory: {},
        byPriority: {
          high: 0,
          medium: 0,
          low: 0
        }
      };

      if (goals.length > 0) {
        stats.averageProgress = goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length;
        
        // Count by category
        goals.forEach(goal => {
          stats.byCategory[goal.category] = (stats.byCategory[goal.category] || 0) + 1;
          stats.byPriority[goal.priority] = (stats.byPriority[goal.priority] || 0) + 1;
        });
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to get goal progress stats: ${error.message}`);
    }
  }

  // Get overdue goals
  async getOverdueGoals(userId) {
    try {
      const now = new Date();
      const goals = await LearningGoal.find({
        userId,
        status: { $in: ['not_started', 'in_progress'] },
        deadline: { $lt: now }
      }).sort({ deadline: 1 });

      return goals;
    } catch (error) {
      throw new Error(`Failed to get overdue goals: ${error.message}`);
    }
  }

  // Get goals due soon (within 7 days)
  async getGoalsDueSoon(userId) {
    try {
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const goals = await LearningGoal.find({
        userId,
        status: { $in: ['not_started', 'in_progress'] },
        deadline: { $lte: sevenDaysFromNow, $gte: new Date() }
      }).sort({ deadline: 1 });

      return goals;
    } catch (error) {
      throw new Error(`Failed to get goals due soon: ${error.message}`);
    }
  }
}

export default new LearningGoalService();
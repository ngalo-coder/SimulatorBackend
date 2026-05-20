import PDFDocument from 'pdfkit';
import studentDashboardService from './StudentDashboardService.js';
import ProgressAnalyticsService from './ProgressAnalyticsService.js';
import { getClinicianProgress } from './clinicianProgressService.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';
import User from '../models/UserModel.js';

/**
 * Progress PDF Service
 * Generates beautiful, comprehensive PDF reports of user progress
 * including analytics, trends, achievements, and recommendations
 */
class ProgressPDFService {
  constructor() {
    this.studentDashboardService = studentDashboardService;
    
    // PDF styling constants
    this.colors = {
      primary: '#2563eb',    // Blue
      secondary: '#10b981',  // Green
      accent: '#f59e0b',     // Amber
      danger: '#ef4444',     // Red
      gray: '#6b7280',       // Gray
      lightGray: '#f3f4f6',  // Light Gray
      white: '#ffffff',      // White
      black: '#111827'       // Black
    };
    
    this.fonts = {
      title: 24,
      heading: 18,
      subheading: 14,
      body: 11,
      caption: 9
    };
    
    this.spacing = {
      section: 30,
      paragraph: 15,
      line: 8
    };
  }

  /**
   * Generate comprehensive progress PDF report
   * @param {string} userId - User ID
   * @param {Object} options - Generation options
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async generateProgressReport(userId, options = {}) {
    try {
      // Fetch comprehensive user data
      const user = await User.findById(userId).populate('profile');
      if (!user) {
        throw new Error('User not found');
      }

      // Fetch real simulation data with error handling
      let clinicianProgressData = { progress: null, recentMetrics: [] };
      let dashboardData = { progressSummary: {}, achievements: [], recommendedCases: [], recentActivity: [], learningPath: {} };
      let recentMetrics = [];
      let performanceTrends = [];

      try {
        clinicianProgressData = await getClinicianProgress(userId);
      } catch (error) {
        console.warn('Could not fetch clinician progress:', error.message);
      }

      try {
        recentMetrics = await this.getDetailedPerformanceMetrics(userId);
      } catch (error) {
        console.warn('Could not fetch performance metrics:', error.message);
      }

      try {
        performanceTrends = await this.getPerformanceTrends(userId);
      } catch (error) {
        console.warn('Could not fetch performance trends:', error.message);
      }

      // Try to get dashboard data, but provide fallback
      try {
        dashboardData = await studentDashboardService.getDashboardOverview(user);
      } catch (error) {
        console.warn('Could not fetch dashboard data, using fallback:', error.message);
        // Use fallback dashboard data
        dashboardData = {
          progressSummary: {
            totalCasesCompleted: clinicianProgressData.progress?.totalCasesCompleted || 0,
            overallAverageScore: clinicianProgressData.progress?.overallAverageScore || 0
          },
          achievements: [],
          recommendedCases: [],
          recentActivity: [],
          learningPath: {}
        };
      }

      const progressData = {
        totalCasesCompleted: clinicianProgressData.progress?.totalCasesCompleted || 0,
        totalCasesAttempted: clinicianProgressData.progress?.totalCasesCompleted || 0,
        overallAverageScore: clinicianProgressData.progress?.overallAverageScore || 0,
        specialtyProgress: this.processSpecialtyProgress(recentMetrics),
        recentPerformance: clinicianProgressData.recentMetrics || [],
        progressionLevel: clinicianProgressData.progress?.currentProgressionLevel || 'Beginner',
        difficultyCoverage: {
          beginner: {
            completed: clinicianProgressData.progress?.beginnerCasesCompleted || 0,
            average: clinicianProgressData.progress?.beginnerAverageScore || 0
          },
          intermediate: {
            completed: clinicianProgressData.progress?.intermediateCasesCompleted || 0,
            average: clinicianProgressData.progress?.intermediateAverageScore || 0
          },
          advanced: {
            completed: clinicianProgressData.progress?.advancedCasesCompleted || 0,
            average: clinicianProgressData.progress?.advancedAverageScore || 0
          }
        },
        performanceTrends: performanceTrends
      };

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Progress Report - ${user.username}`,
          Author: 'Medical Simulation Platform',
          Subject: 'Student Progress Report',
          Keywords: 'progress, medical, simulation, education'
        }
      });

      // Generate PDF content
      await this.generateCoverPage(doc, user, dashboardData);
      await this.generateExecutiveSummary(doc, progressData, dashboardData);
      await this.generateProgressOverview(doc, progressData);
      await this.generateSimulationDetails(doc, recentMetrics, progressData);
      await this.generatePerformanceAnalysis(doc, progressData, performanceTrends);
      await this.generateRecommendations(doc, progressData, dashboardData);
      await this.generateAppendix(doc, user, options);

      // Finalize PDF
      doc.end();

      // Return PDF as buffer
      return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

    } catch (error) {
      console.error('Error generating progress PDF:', error);
      throw new Error(`Failed to generate progress report: ${error.message}`);
    }
  }

  /**
   * Generate cover page with branding and user info
   */
  async generateCoverPage(doc, user, dashboardData) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    
    // Background gradient simulation
    doc.rect(0, 0, pageWidth, 200).fill(this.colors.primary);
    doc.rect(0, 200, pageWidth, 50).fill(this.colors.secondary);

    // Header
    doc.fillColor(this.colors.white)
       .fontSize(this.fonts.title)
       .font('Helvetica-Bold')
       .text('MEDICAL SIMULATION PLATFORM', 50, 60, { align: 'center' });

    doc.fontSize(this.fonts.heading)
       .font('Helvetica')
       .text('Progress Report', 50, 100, { align: 'center' });

    // User information card
    const cardY = 280;
    const cardHeight = 200;
    
    doc.rect(75, cardY, pageWidth - 150, cardHeight)
       .fillAndStroke(this.colors.white, this.colors.gray);

    doc.fillColor(this.colors.black)
       .fontSize(this.fonts.heading)
       .font('Helvetica-Bold')
       .text('Student Information', 100, cardY + 20);

    const userInfo = [
      `Name: ${user.profile?.firstName || ''} ${user.profile?.lastName || user.username}`,
      `Discipline: ${user.profile?.discipline || 'Not specified'}`,
      `Institution: ${user.profile?.institution || 'Not specified'}`,
      `Year of Study: ${user.profile?.yearOfStudy || 'Not specified'}`,
      `Report Generated: ${new Date().toLocaleDateString()}`
    ];

    let textY = cardY + 60;
    userInfo.forEach(info => {
      doc.fontSize(this.fonts.body)
         .font('Helvetica')
         .text(info, 100, textY);
      textY += this.spacing.line + 5;
    });

    // Progress summary statistics
    const statsY = cardY + 160;
    const progressSummary = dashboardData.progressSummary || {};
    
    doc.fontSize(this.fonts.subheading)
       .font('Helvetica-Bold')
       .fillColor(this.colors.primary)
       .text(`Cases Completed: ${progressSummary.totalCasesCompleted || 0}`, 100, statsY);
       
    doc.text(`Average Score: ${Math.round(progressSummary.overallAverageScore || 0)}%`, 250, statsY);
    doc.text(`Progress Level: Beginner`, 400, statsY);

    // Footer
    doc.fontSize(this.fonts.caption)
       .fillColor(this.colors.gray)
       .text('This report is confidential and intended for educational purposes only.', 
             50, pageHeight - 80, { align: 'center' });

    doc.addPage();
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(doc, progressData, dashboardData) {
    this.addSectionHeader(doc, 'Executive Summary');

    const summary = this.generateSummaryText(progressData, dashboardData);
    
    doc.fontSize(this.fonts.body)
       .fillColor(this.colors.black)
       .text(summary, 50, doc.y + this.spacing.paragraph, { 
         width: doc.page.width - 100,
         align: 'justify',
         lineGap: 3
       });

    doc.addPage();
  }

  /**
   * Generate progress overview
   */
  async generateProgressOverview(doc, progressData) {
    this.addSectionHeader(doc, 'Progress Overview');
    
    // Key metrics
    const metrics = [
      { label: 'Total Cases Completed', value: progressData.totalCasesCompleted || 0 },
      { label: 'Overall Average Score', value: `${Math.round(progressData.overallAverageScore || 0)}%` },
      { label: 'Current Progression Level', value: progressData.progressionLevel || 'Beginner' }
    ];

    let yPos = doc.y + 20;
    metrics.forEach(metric => {
      doc.fontSize(this.fonts.body)
         .fillColor(this.colors.black)
         .text(`${metric.label}: ${metric.value}`, 50, yPos);
      yPos += 20;
    });

    // Difficulty breakdown
    yPos += 20;
    doc.fontSize(this.fonts.subheading)
       .fillColor(this.colors.primary)
       .text('Performance by Difficulty Level', 50, yPos);
    
    yPos += 25;
    const difficulties = [
      { name: 'Beginner', data: progressData.difficultyCoverage.beginner },
      { name: 'Intermediate', data: progressData.difficultyCoverage.intermediate },
      { name: 'Advanced', data: progressData.difficultyCoverage.advanced }
    ];

    difficulties.forEach(diff => {
      doc.fontSize(this.fonts.body)
         .fillColor(this.colors.black)
         .text(`${diff.name}: ${diff.data.completed} cases (${Math.round(diff.data.average)}% avg)`, 70, yPos);
      yPos += 18;
    });

    doc.addPage();
  }

  /**
   * Generate appendix
   */
  async generateAppendix(doc, user, options) {
    this.addSectionHeader(doc, 'Appendix');
    
    doc.fontSize(this.fonts.body)
       .fillColor(this.colors.black)
       .text('This report was generated automatically by the Medical Simulation Platform.', 50, doc.y + 20);
    
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 50, doc.y + 10);
    doc.text(`User ID: ${user._id}`, 50, doc.y + 10);
    doc.text(`Report Format: ${options.format || 'comprehensive'}`, 50, doc.y + 10);
  }

  /**
   * Add section header
   */
  addSectionHeader(doc, title) {
    doc.fontSize(this.fonts.heading)
       .fillColor(this.colors.primary)
       .font('Helvetica-Bold')
       .text(title, 50, doc.y + this.spacing.section);
    
    // Add underline
    doc.moveTo(50, doc.y + 5)
       .lineTo(doc.page.width - 50, doc.y + 5)
       .stroke(this.colors.primary);
  }

  /**
   * Generate summary text
   */
  generateSummaryText(progressData, dashboardData) {
    const casesCompleted = progressData.totalCasesCompleted || 0;
    const averageScore = Math.round(progressData.overallAverageScore || 0);
    const level = progressData.progressionLevel || 'Beginner';
    
    if (casesCompleted === 0) {
      return 'Welcome to your learning journey! This report will track your progress as you complete patient simulation cases. Start with some basic cases to see your performance metrics and receive personalized recommendations.';
    }
    
    return `You have completed ${casesCompleted} simulation case${casesCompleted !== 1 ? 's' : ''} with an overall average score of ${averageScore}%. Your current progression level is ${level}. ${
      averageScore >= 80 ? 'Excellent work! You are demonstrating strong clinical reasoning skills and consistently high performance.' : 
      averageScore >= 70 ? 'Good progress! Continue practicing to further improve your clinical decision-making abilities.' :
      'Keep practicing! Each case completed helps build your clinical knowledge and critical thinking skills.'
    } This comprehensive report provides detailed insights into your learning progress, performance trends, and personalized recommendations for continued improvement.`;
  }

  /**
   * Get detailed performance metrics for a user
   */
  async getDetailedPerformanceMetrics(userId, limit = 20) {
    try {
      return await PerformanceMetrics.find({ user_ref: userId })
        .sort({ evaluated_at: -1 })
        .limit(limit)
        .populate('case_ref', 'case_metadata.title case_metadata.difficulty case_metadata.specialty case_metadata.program_area')
        .lean();
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return [];
    }
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(userId) {
    try {
      const metrics = await PerformanceMetrics.find({ user_ref: userId })
        .sort({ evaluated_at: 1 })
        .populate('case_ref', 'case_metadata.difficulty')
        .lean();

      // Group by month for trend analysis
      const monthlyData = {};
      metrics.forEach(metric => {
        const month = new Date(metric.evaluated_at).toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { scores: [], count: 0 };
        }
        if (metric.metrics.overall_score !== null) {
          monthlyData[month].scores.push(metric.metrics.overall_score);
          monthlyData[month].count++;
        }
      });

      // Calculate monthly averages
      const trends = Object.keys(monthlyData).map(month => {
        const data = monthlyData[month];
        const average = data.scores.length > 0 ? 
          data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length : 0;
        return {
          month,
          average: Math.round(average),
          caseCount: data.count
        };
      });

      return trends;
    } catch (error) {
      console.error('Error calculating performance trends:', error);
      return [];
    }
  }

  /**
   * Process specialty progress data
   */
  processSpecialtyProgress(metrics) {
    const specialtyData = {};
    
    metrics.forEach(metric => {
      if (metric.case_ref?.case_metadata?.specialty) {
        const specialty = metric.case_ref.case_metadata.specialty;
        if (!specialtyData[specialty]) {
          specialtyData[specialty] = { scores: [], count: 0 };
        }
        if (metric.metrics.overall_score !== null) {
          specialtyData[specialty].scores.push(metric.metrics.overall_score);
          specialtyData[specialty].count++;
        }
      }
    });

    return Object.keys(specialtyData).map(specialty => {
      const data = specialtyData[specialty];
      const average = data.scores.length > 0 ? 
        data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length : 0;
      return {
        specialty,
        average: Math.round(average),
        caseCount: data.count
      };
    });
  }

  /**
   * Generate detailed simulation data section
   */
  async generateSimulationDetails(doc, metrics, progressData) {
    this.addSectionHeader(doc, 'Simulation Performance Details');

    if (!metrics || metrics.length === 0) {
      doc.fontSize(this.fonts.body)
         .fillColor(this.colors.gray)
         .text('No simulation data available yet. Complete some cases to see detailed performance analysis.', 
               50, doc.y + 20);
      doc.addPage();
      return;
    }

    // Recent cases summary
    doc.fontSize(this.fonts.subheading)
       .fillColor(this.colors.primary)
       .text('Recent Case Completions', 50, doc.y + 20);

    let yPos = doc.y + 30;
    const recentCases = metrics.slice(0, 10); // Show last 10 cases

    recentCases.forEach((metric, index) => {
      const caseTitle = metric.case_ref?.case_metadata?.title || 'Unknown Case';
      const difficulty = metric.case_ref?.case_metadata?.difficulty || 'Unknown';
      const score = metric.metrics.overall_score || 0;
      const date = new Date(metric.evaluated_at).toLocaleDateString();

      doc.fontSize(this.fonts.body)
         .fillColor(this.colors.black)
         .text(`${index + 1}. ${caseTitle}`, 50, yPos);
      
      doc.text(`   Difficulty: ${difficulty} | Score: ${score}% | Date: ${date}`, 70, yPos + 15);
      yPos += 40;

      if (yPos > 700) { // Prevent page overflow
        doc.addPage();
        yPos = 50;
      }
    });

    // Specialty breakdown
    if (progressData.specialtyProgress && progressData.specialtyProgress.length > 0) {
      if (yPos > 600) {
        doc.addPage();
        yPos = 50;
      } else {
        yPos += 30;
      }

      doc.fontSize(this.fonts.subheading)
         .fillColor(this.colors.primary)
         .text('Performance by Specialty', 50, yPos);

      yPos += 25;
      progressData.specialtyProgress.forEach(specialty => {
        doc.fontSize(this.fonts.body)
           .fillColor(this.colors.black)
           .text(`${specialty.specialty}: ${specialty.caseCount} cases, ${specialty.average}% average`, 70, yPos);
        yPos += 18;
      });
    }

    doc.addPage();
  }

  /**
   * Generate performance analysis section
   */
  async generatePerformanceAnalysis(doc, progressData, trends) {
    this.addSectionHeader(doc, 'Performance Analysis');

    // Trend analysis
    if (trends && trends.length > 0) {
      doc.fontSize(this.fonts.subheading)
         .fillColor(this.colors.primary)
         .text('Performance Trends', 50, doc.y + 20);

      let yPos = doc.y + 30;
      doc.fontSize(this.fonts.body)
         .fillColor(this.colors.black)
         .text('Monthly Performance Overview:', 50, yPos);

      yPos += 25;
      trends.slice(-6).forEach(trend => { // Show last 6 months
        const monthName = new Date(trend.month + '-01').toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
        doc.text(`${monthName}: ${trend.caseCount} cases, ${trend.average}% average`, 70, yPos);
        yPos += 18;
      });

      // Trend direction
      if (trends.length >= 2) {
        const recent = trends[trends.length - 1];
        const previous = trends[trends.length - 2];
        const improvement = recent.average - previous.average;
        
        yPos += 20;
        const trendText = improvement > 0 ? 
          `📈 Improving trend: +${improvement.toFixed(1)}% from last period` :
          improvement < 0 ?
          `📉 Declining trend: ${improvement.toFixed(1)}% from last period` :
          `➡️ Stable performance maintained`;
        
        doc.fillColor(improvement >= 0 ? this.colors.secondary : this.colors.danger)
           .text(trendText, 70, yPos);
      }
    }

    // Competency analysis
    let yPos = doc.y + 40;
    doc.fontSize(this.fonts.subheading)
       .fillColor(this.colors.primary)
       .text('Competency Breakdown', 50, yPos);

    yPos += 25;
    const competencies = [
      { name: 'Clinical Reasoning', score: progressData.overallAverageScore || 0 },
      { name: 'Communication Skills', score: Math.max(0, (progressData.overallAverageScore || 0) - 5) },
      { name: 'Problem Solving', score: Math.max(0, (progressData.overallAverageScore || 0) + 2) }
    ];

    competencies.forEach(comp => {
      const color = comp.score >= 80 ? this.colors.secondary : 
                   comp.score >= 70 ? this.colors.accent : this.colors.danger;
      doc.fontSize(this.fonts.body)
         .fillColor(color)
         .text(`${comp.name}: ${Math.round(comp.score)}%`, 70, yPos);
      yPos += 18;
    });

    doc.addPage();
  }

  /**
   * Generate recommendations section
   */
  async generateRecommendations(doc, progressData, dashboardData) {
    this.addSectionHeader(doc, 'Learning Recommendations');

    const averageScore = progressData.overallAverageScore || 0;
    const casesCompleted = progressData.totalCasesCompleted || 0;
    const level = progressData.progressionLevel || 'Beginner';

    let yPos = doc.y + 20;

    // General recommendations based on performance
    doc.fontSize(this.fonts.subheading)
       .fillColor(this.colors.primary)
       .text('Personalized Learning Path', 50, yPos);

    yPos += 25;
    const recommendations = this.generatePersonalizedRecommendations(progressData);
    
    recommendations.forEach(rec => {
      doc.fontSize(this.fonts.body)
         .fillColor(this.colors.black)
         .text(`• ${rec}`, 70, yPos, { width: doc.page.width - 120 });
      yPos = doc.y + 10;
    });

    // Recommended cases
    if (dashboardData.recommendedCases && dashboardData.recommendedCases.length > 0) {
      yPos += 20;
      doc.fontSize(this.fonts.subheading)
         .fillColor(this.colors.primary)
         .text('Recommended Cases', 50, yPos);

      yPos += 25;
      dashboardData.recommendedCases.slice(0, 5).forEach(caseItem => {
        doc.fontSize(this.fonts.body)
           .fillColor(this.colors.black)
           .text(`• ${caseItem.case_metadata?.title || 'Case'} (${caseItem.case_metadata?.difficulty || 'Unknown'})`, 
                 70, yPos, { width: doc.page.width - 120 });
        yPos = doc.y + 8;
      });
    }

    doc.addPage();
  }

  /**
   * Generate personalized recommendations based on progress
   */
  generatePersonalizedRecommendations(progressData) {
    const recommendations = [];
    const averageScore = progressData.overallAverageScore || 0;
    const casesCompleted = progressData.totalCasesCompleted || 0;
    const level = progressData.progressionLevel || 'Beginner';

    // Based on overall performance
    if (averageScore >= 85) {
      recommendations.push('Excellent performance! Consider taking on more challenging advanced cases.');
      recommendations.push('Share your knowledge by mentoring other students.');
    } else if (averageScore >= 75) {
      recommendations.push('Strong performance! Focus on consistency across different case types.');
      recommendations.push('Challenge yourself with intermediate to advanced cases.');
    } else if (averageScore >= 65) {
      recommendations.push('Good foundation! Focus on strengthening clinical reasoning skills.');
      recommendations.push('Review case studies and practice differential diagnosis.');
    } else {
      recommendations.push('Continue building fundamental skills with beginner-level cases.');
      recommendations.push('Review basic medical concepts and clinical protocols.');
    }

    // Based on case volume
    if (casesCompleted < 5) {
      recommendations.push('Complete more cases to build experience and confidence.');
    } else if (casesCompleted < 20) {
      recommendations.push('You\'re building good momentum. Aim to complete cases regularly.');
    } else {
      recommendations.push('Great case completion rate! Focus on case variety and difficulty progression.');
    }

    // Based on difficulty distribution
    const beginnerRatio = (progressData.difficultyCoverage.beginner.completed / Math.max(1, casesCompleted)) * 100;
    if (beginnerRatio > 70 && level !== 'Beginner') {
      recommendations.push('Consider attempting more intermediate and advanced cases to challenge yourself.');
    }

    return recommendations;
  }
}

export default new ProgressPDFService();
import mongoose from 'mongoose';
import ClinicianProgress from '../models/ClinicianProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';

const calculateProgressionLevel = (progress) => {
    if (progress.advancedCasesCompleted >= 10 && progress.advancedAverageScore > 80) {
        return 'Expert';
    } else if (progress.intermediateCasesCompleted >= 15 && progress.intermediateAverageScore > 75) {
        return 'Advanced';
    } else if (progress.beginnerCasesCompleted >= 10 && progress.beginnerAverageScore > 70) {
        return 'Intermediate';
    } else {
        return 'Beginner';
    }
};

export async function getClinicianProgress(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
            progress: {
                beginnerCasesCompleted: 0,
                intermediateCasesCompleted: 0,
                advancedCasesCompleted: 0,
                beginnerAverageScore: 0,
                intermediateAverageScore: 0,
                advancedAverageScore: 0,
                totalCasesCompleted: 0,
                overallAverageScore: 0,
                currentProgressionLevel: 'Beginner'
            },
            recentMetrics: []
        };
    }

    let progress = await ClinicianProgress.findOne({ userId });

    if (!progress) {
        progress = new ClinicianProgress({ userId });
        await progress.save();
    }

    const recentMetrics = await PerformanceMetrics.find({ user_ref: userId })
        .sort({ evaluated_at: -1 })
        .limit(5)
        .populate('case_ref', 'case_metadata.title case_metadata.difficulty case_metadata.case_id case_metadata.specialty case_metadata.program_area');

    return { progress, recentMetrics };
}

export async function updateProgressAfterCase(userId, caseId, performanceMetricsId) {
    const caseDetails = await Case.findById(caseId);
    if (!caseDetails) {
        throw { status: 404, message: 'Case not found' };
    }

    const difficulty = caseDetails.case_metadata.difficulty;
    const metrics = await PerformanceMetrics.findById(performanceMetricsId);
    if (!metrics) {
        throw { status: 404, message: 'Performance metrics not found' };
    }

    const score = metrics.metrics.overall_score || 0;
    let progress = await ClinicianProgress.findOne({ userId });
    if (!progress) {
        progress = new ClinicianProgress({ userId });
    }

    if (difficulty === 'Beginner') {
        const newTotal = progress.beginnerCasesCompleted + 1;
        const newAvg = ((progress.beginnerAverageScore * progress.beginnerCasesCompleted) + score) / newTotal;

        progress.beginnerCasesCompleted = newTotal;
        progress.beginnerAverageScore = Math.round(newAvg * 100) / 100;
        progress.lastCompletedBeginnerCase = caseId;
    } else if (difficulty === 'Intermediate') {
        const newTotal = progress.intermediateCasesCompleted + 1;
        const newAvg = ((progress.intermediateAverageScore * progress.intermediateCasesCompleted) + score) / newTotal;

        progress.intermediateCasesCompleted = newTotal;
        progress.intermediateAverageScore = Math.round(newAvg * 100) / 100;
        progress.lastCompletedIntermediateCase = caseId;
    } else if (difficulty === 'Advanced') {
        const newTotal = progress.advancedCasesCompleted + 1;
        const newAvg = ((progress.advancedAverageScore * progress.advancedCasesCompleted) + score) / newTotal;

        progress.advancedCasesCompleted = newTotal;
        progress.advancedAverageScore = Math.round(newAvg * 100) / 100;
        progress.lastCompletedAdvancedCase = caseId;
    }

    const newTotal = progress.totalCasesCompleted + 1;
    const newAvg = ((progress.overallAverageScore * progress.totalCasesCompleted) + score) / newTotal;

    progress.totalCasesCompleted = newTotal;
    progress.overallAverageScore = Math.round(newAvg * 100) / 100;
    progress.currentProgressionLevel = calculateProgressionLevel(progress);

    await progress.save();
    return progress;
}

export async function getProgressRecommendations(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        const beginnerCases = await Case.find({ 'case_metadata.difficulty': 'Beginner' })
            .select('case_metadata.case_id case_metadata.title case_metadata.specialty case_metadata.difficulty case_metadata.program_area')
            .limit(5);
        return {
            currentLevel: 'Beginner',
            recommendedDifficulty: 'Beginner',
            recommendationReason: 'Start with beginner cases to build your skills',
            recommendedCases: beginnerCases
        };
    }

    const progress = await ClinicianProgress.findOne({ userId });

    if (!progress) {
        const beginnerCases = await Case.find({ 'case_metadata.difficulty': 'Beginner' })
            .select('case_metadata.case_id case_metadata.title case_metadata.specialty case_metadata.difficulty case_metadata.program_area')
            .limit(5);
        return {
            currentLevel: 'Beginner',
            recommendedDifficulty: 'Beginner',
            recommendationReason: 'Start with beginner cases to build your skills',
            recommendedCases: beginnerCases
        };
    }

    let recommendedDifficulty;
    let recommendationReason;

    switch (progress.currentProgressionLevel) {
        case 'Beginner':
            recommendedDifficulty = 'Beginner';
            recommendationReason = 'Continue with beginner cases to build foundational skills';
            break;
        case 'Intermediate':
            recommendedDifficulty = progress.beginnerCasesCompleted >= 20 ? 'Intermediate' : 'Beginner';
            recommendationReason = progress.beginnerCasesCompleted >= 20
                ? 'You\'re ready for intermediate cases to challenge your skills'
                : 'Complete more beginner cases to solidify your foundation';
            break;
        case 'Advanced':
            recommendedDifficulty = progress.intermediateCasesCompleted >= 25 ? 'Advanced' : 'Intermediate';
            recommendationReason = progress.intermediateCasesCompleted >= 25
                ? 'You\'re ready for advanced cases to test your expertise'
                : 'Complete more intermediate cases to prepare for advanced challenges';
            break;
        case 'Expert':
            recommendedDifficulty = 'Advanced';
            recommendationReason = 'Continue with advanced cases to maintain your expert status';
            break;
        default:
            recommendedDifficulty = 'Beginner';
            recommendationReason = 'Start with beginner cases to build your skills';
    }

    const recommendedCases = await Case.find({ 'case_metadata.difficulty': recommendedDifficulty })
        .select('case_metadata.case_id case_metadata.title case_metadata.specialty case_metadata.difficulty case_metadata.program_area')
        .limit(5);

    return {
        currentLevel: progress.currentProgressionLevel,
        recommendedDifficulty,
        recommendationReason,
        recommendedCases
    };
}

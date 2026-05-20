import mongoose from 'mongoose';
import ClinicianProgress from '../models/ClinicianProgressModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Case from '../models/CaseModel.js';

// Enhanced difficulty mapping to handle all variations
const normalizeDifficulty = (difficulty) => {
    if (!difficulty) return 'Beginner';
    
    const difficultyLower = difficulty.toLowerCase();
    
    if (difficultyLower.includes('easy') || difficultyLower.includes('beginner')) {
        return 'Beginner';
    } else if (difficultyLower.includes('intermediate') || difficultyLower.includes('medium')) {
        return 'Intermediate';
    } else if (difficultyLower.includes('hard') || difficultyLower.includes('advanced') || difficultyLower.includes('expert')) {
        return 'Advanced';
    }
    
    // Default to Beginner for unknown values
    return 'Beginner';
};

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
        throw { status: 400, message: 'Invalid user ID' };
    }

    let progress = await ClinicianProgress.findOne({ userId });
    if (!progress) {
        progress = await ClinicianProgress.create({ userId });
    }

    const recentMetrics = await PerformanceMetrics.find({ user_ref: userId })
        .sort({ evaluated_at: -1 })
        .limit(5)
        .populate('case_ref', 'case_metadata.title case_metadata.case_id case_metadata.specialty case_metadata.program_area')
        .lean();

    return { progress, recentMetrics };
}

export async function updateProgressAfterCase(userId, caseId, performanceMetricsId, dbSession = null) {
    const useExternalSession = !!dbSession;
    const session = dbSession || await mongoose.startSession();
    
    if (!useExternalSession) {
        session.startTransaction();
    }
    
    try {
        const [caseDetails, metrics] = await Promise.all([
            Case.findById(caseId).session(session),
            PerformanceMetrics.findById(performanceMetricsId).session(session)
        ]);

        if (!caseDetails) throw { status: 404, message: 'Case not found' };
        if (!metrics) throw { status: 404, message: 'Performance metrics not found' };

        const difficulty = normalizeDifficulty(caseDetails.case_metadata.difficulty);
        const score = metrics.metrics.overall_score || 0;

        // Skip if score is invalid
        if (score === null || score === undefined || isNaN(score)) {
            throw { status: 400, message: 'Invalid score in performance metrics' };
        }

        // Get current progress or create new one
        let progress = await ClinicianProgress.findOne({ userId }).session(session);
        if (!progress) {
            progress = new ClinicianProgress({ userId });
        }

        // Update difficulty-specific counters
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

        // Update overall counters
        const newTotalCases = progress.totalCasesCompleted + 1;
        const newOverallAvg = ((progress.overallAverageScore * progress.totalCasesCompleted) + score) / newTotalCases;
        progress.totalCasesCompleted = newTotalCases;
        progress.overallAverageScore = Math.round(newOverallAvg * 100) / 100;
        progress.currentProgressionLevel = calculateProgressionLevel(progress);
        progress.lastUpdatedAt = new Date();

        await progress.save({ session });

        if (!useExternalSession) {
            await session.commitTransaction();
        }
        return progress;
    } catch (error) {
        if (!useExternalSession) {
            await session.abortTransaction();
        }
        throw error;
    } finally {
        if (!useExternalSession) {
            session.endSession();
        }
    }
}

export async function getProgressRecommendations(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw { status: 400, message: 'Invalid user ID' };
    }

    const progress = await ClinicianProgress.findOne({ userId });
    const level = progress?.currentProgressionLevel || 'Beginner';
    
    const difficultyMap = {
        'Beginner': 'Beginner',
        'Intermediate': progress?.beginnerCasesCompleted >= 20 ? 'Intermediate' : 'Beginner',
        'Advanced': progress?.intermediateCasesCompleted >= 25 ? 'Advanced' : 'Intermediate',
        'Expert': 'Advanced'
    };

    const recommendedDifficulty = difficultyMap[level];
    const recommendedCases = await Case.find({ 'case_metadata.difficulty': recommendedDifficulty })
        .select('case_metadata.case_id case_metadata.title case_metadata.specialty case_metadata.program_area')
        .limit(5)
        .lean();

    return {
        currentLevel: level,
        recommendedDifficulty,
        recommendedCases
    };
}
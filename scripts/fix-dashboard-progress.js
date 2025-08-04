import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PerformanceMetrics from '../src/models/PerformanceMetricsModel.js';
import ClinicianProgress from '../src/models/ClinicianProgressModel.js';
import Case from '../src/models/CaseModel.js';
import User from '../src/models/UserModel.js';

dotenv.config();

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

async function fixDashboardProgress() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔧 FIXING DASHBOARD PROGRESS DATA');
        console.log('='.repeat(60));

        // Get all users who have performance records but incorrect progress
        const usersWithPerformance = await PerformanceMetrics.distinct('user_ref');
        console.log(`📊 Found ${usersWithPerformance.length} users with performance records`);

        for (const userId of usersWithPerformance) {
            console.log(`\\n🔍 Processing user: ${userId}`);
            
            // Get user details
            const user = await User.findById(userId);
            if (!user) {
                console.log(`❌ User ${userId} not found, skipping...`);
                continue;
            }
            
            console.log(`👤 Processing: ${user.email}`);

            // Get all performance records for this user
            const performanceRecords = await PerformanceMetrics.find({ user_ref: userId })
                .populate('case_ref', 'case_metadata.difficulty')
                .sort({ createdAt: 1 });

            if (performanceRecords.length === 0) {
                console.log(`   No performance records found`);
                continue;
            }

            console.log(`   Found ${performanceRecords.length} performance records`);

            // Initialize progress counters
            let beginnerCases = 0, intermediateCases = 0, advancedCases = 0;
            let beginnerScores = [], intermediateScores = [], advancedScores = [];
            let allScores = [];

            // Process each performance record
            for (const record of performanceRecords) {
                const score = record.metrics?.overall_score || 0;
                const difficulty = record.case_ref?.case_metadata?.difficulty || 'Beginner';
                
                allScores.push(score);

                switch (difficulty) {
                    case 'Easy':
                    case 'Beginner':
                        beginnerCases++;
                        beginnerScores.push(score);
                        break;
                    case 'Intermediate':
                        intermediateCases++;
                        intermediateScores.push(score);
                        break;
                    case 'Hard':
                    case 'Advanced':
                        advancedCases++;
                        advancedScores.push(score);
                        break;
                    default:
                        beginnerCases++;
                        beginnerScores.push(score);
                }
            }

            // Calculate averages
            const beginnerAvg = beginnerScores.length > 0 ? 
                Math.round((beginnerScores.reduce((a, b) => a + b, 0) / beginnerScores.length) * 100) / 100 : 0;
            const intermediateAvg = intermediateScores.length > 0 ? 
                Math.round((intermediateScores.reduce((a, b) => a + b, 0) / intermediateScores.length) * 100) / 100 : 0;
            const advancedAvg = advancedScores.length > 0 ? 
                Math.round((advancedScores.reduce((a, b) => a + b, 0) / advancedScores.length) * 100) / 100 : 0;
            const overallAvg = allScores.length > 0 ? 
                Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100 : 0;

            // Create or update progress record
            const progressData = {
                userId: userId,
                beginnerCasesCompleted: beginnerCases,
                intermediateCasesCompleted: intermediateCases,
                advancedCasesCompleted: advancedCases,
                beginnerAverageScore: beginnerAvg,
                intermediateAverageScore: intermediateAvg,
                advancedAverageScore: advancedAvg,
                totalCasesCompleted: allScores.length,
                overallAverageScore: overallAvg,
                currentProgressionLevel: calculateProgressionLevel({
                    beginnerCasesCompleted: beginnerCases,
                    intermediateCasesCompleted: intermediateCases,
                    advancedCasesCompleted: advancedCases,
                    beginnerAverageScore: beginnerAvg,
                    intermediateAverageScore: intermediateAvg,
                    advancedAverageScore: advancedAvg
                })
            };

            await ClinicianProgress.findOneAndUpdate(
                { userId: userId },
                progressData,
                { upsert: true, new: true }
            );

            console.log(`   ✅ Updated progress:`);
            console.log(`      - Total cases: ${allScores.length}`);
            console.log(`      - Overall average: ${overallAvg}%`);
            console.log(`      - Beginner: ${beginnerCases} cases (avg: ${beginnerAvg}%)`);
            console.log(`      - Intermediate: ${intermediateCases} cases (avg: ${intermediateAvg}%)`);
            console.log(`      - Advanced: ${advancedCases} cases (avg: ${advancedAvg}%)`);
            console.log(`      - Level: ${progressData.currentProgressionLevel}`);
        }

        console.log('\\n🎉 DASHBOARD PROGRESS FIX COMPLETED!');
        console.log('✅ All user progress records have been recalculated');
        console.log('✅ Dashboard should now show correct data');

    } catch (error) {
        console.error('❌ Error fixing dashboard progress:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the fix
fixDashboardProgress();
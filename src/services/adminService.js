import User from '../models/UserModel.js';
import Case from '../models/CaseModel.js';
import PerformanceMetrics from '../models/PerformanceMetricsModel.js';
import Session from '../models/SessionModel.js';
import mongoose from 'mongoose';

export async function createAdminUser(adminData) {
    const { username, email, password } = adminData;

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
        throw { status: 409, message: 'User already exists with this username or email.' };
    }

    const newAdmin = new User({
        username,
        email,
        password,
        role: 'admin'
    });

    await newAdmin.save();
    return newAdmin;
}

export async function getAllUsersForAdmin() {
    const users = await User.find({}).select('-password');
    const formattedUsers = users.map(user => ({
        id: user._id.toString(),
        name: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin || user.createdAt,
        casesCompleted: 0
    }));
    return formattedUsers;
}

export async function updateUserRoleForAdmin(userId, role) {
    const user = await User.findById(userId);
    if (!user) {
        throw { status: 404, message: 'User not found.' };
    }

    user.role = role;
    await user.save();
    return user;
}

export async function deleteUserForAdmin(userId) {
    const user = await User.findById(userId);
    if (!user) {
        throw { status: 404, message: 'User not found.' };
    }

    await User.findByIdAndDelete(userId);
}

export async function getProgramAreasForAdmin() {
    const programAreas = await Case.distinct('case_metadata.program_area');
    return programAreas;
}

export async function getSpecialtiesForAdmin() {
    const specialties = await Case.distinct('case_metadata.specialty');
    return specialties;
}

export async function getAllCasesForAdmin() {
    const cases = await Case.find({}, {
        'case_metadata.case_id': 1,
        'case_metadata.title': 1,
        'case_metadata.specialty': 1,
        'case_metadata.program_area': 1,
        'case_metadata.difficulty': 1, // Keep for admin management, hidden from regular users
        'createdAt': 1
    });

    const formattedCases = cases.map(caseItem => ({
        id: caseItem.case_metadata.case_id,
        title: caseItem.case_metadata.title,
        programArea: caseItem.case_metadata.program_area,
        specialty: caseItem.case_metadata.specialty,
        difficulty: caseItem.case_metadata.difficulty, // Admin-only field
        createdAt: caseItem.createdAt,
        timesCompleted: 0,
        averageScore: 0
    }));

    return formattedCases;
}

export async function updateCaseForAdmin(caseId, updateData) {
    const caseToUpdate = await Case.findOne({ 'case_metadata.case_id': caseId });
    if (!caseToUpdate) {
        throw { status: 404, message: 'Case not found.' };
    }

    if (updateData.programArea) {
        caseToUpdate.case_metadata.program_area = updateData.programArea;
    }

    if (updateData.specialty) {
        caseToUpdate.case_metadata.specialty = updateData.specialty;
    }

    await caseToUpdate.save();
    return caseToUpdate;
}

export async function deleteCaseForAdmin(caseId) {
    const result = await Case.findOneAndDelete({ 'case_metadata.case_id': caseId });
    if (!result) {
        throw { status: 404, message: 'Case not found.' };
    }
}

export async function getUsersWithScoresForAdmin() {
    const users = await User.find({}).select('-password');

    // Aggregate performance metrics per user
    const performanceMetrics = await PerformanceMetrics.aggregate([
        { $match: { user_ref: { $exists: true } } },
        {
            $group: {
                _id: '$user_ref',
                avgScore: { $avg: { $ifNull: ['$metrics.overall_score', 0] } },
                totalCases: { $sum: 1 },
                excellentCount: { $sum: { $cond: [{ $gte: ['$metrics.overall_score', 85] }, 1, 0] } }
            }
        }
    ]);

    const userMetricsMap = new Map();
    performanceMetrics.forEach(metric => {
        userMetricsMap.set(metric._id.toString(), {
            averageScore: Math.round(metric.avgScore || 0),
            totalCases: metric.totalCases || 0,
            excellentCount: metric.excellentCount || 0
        });
    });

    const usersWithScores = users.map(user => {
        const userId = user._id.toString();
        const metrics = userMetricsMap.get(userId) || { averageScore: 0, totalCases: 0, excellentCount: 0 };

        const excellentRate = metrics.totalCases > 0 ? Math.round((metrics.excellentCount / metrics.totalCases) * 100) : 0;

        return {
            id: userId,
            username: user.username,
            email: user.email,
            role: user.primaryRole || user.role || 'student',
            totalCases: metrics.totalCases,
            averageScore: metrics.averageScore,
            excellentCount: metrics.excellentCount,
            excellentRate,
            createdAt: user.createdAt
        };
    });

    return usersWithScores;
}

export async function getSystemStatsForAdmin() {
    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userCount = totalUsers - adminCount;
    const totalCases = await Case.countDocuments();
    const beginnerCases = await Case.countDocuments({ 'case_metadata.difficulty': 'Easy' });
    const intermediateCases = await Case.countDocuments({ 'case_metadata.difficulty': 'Intermediate' });
    const advancedCases = await Case.countDocuments({ 'case_metadata.difficulty': 'Hard' });
    const programAreas = await Case.distinct('case_metadata.program_area');
    const programAreaCounts = {};

    for (const area of programAreas) {
        const count = await Case.countDocuments({ 'case_metadata.program_area': area });
        programAreaCounts[area] = count;
    }

    const totalSessions = await Session.countDocuments();
    const activeSessions = await Session.countDocuments({ sessionEnded: false });
    // Count distinct active users (users who have at least one active session)
    const activeUserIds = await Session.distinct('user', { sessionEnded: false, user: { $exists: true } });
    const activeUsers = Array.isArray(activeUserIds) ? activeUserIds.filter(id => id).length : 0;

    const systemStats = {
        totalUsers,
        totalCases,
        totalSessions,
        activeSessions,
        activeUsers,
        casesByDifficulty: {
            Beginner: beginnerCases,
            Intermediate: intermediateCases,
            Advanced: advancedCases
        },
        casesByProgramArea: programAreaCounts,
        usersByRole: {
            Admin: adminCount,
            Clinician: userCount,
            Instructor: 0
        }
    };
    return systemStats;
}

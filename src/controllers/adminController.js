import * as adminService from '../services/adminService.js';
import { handleSuccess, handleError } from '../utils/responseHandler.js';
import logger from '../config/logger.js';

export async function createAdmin(req, res) {
    const log = req.log || logger;
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            log.warn({ body: req.body }, 'Admin creation attempt with missing fields.');
            return res.status(400).json({ message: 'Please provide username, email, and password.' });
        }

        if (req.user.role !== 'admin') {
            log.warn({ userId: req.user.id }, 'Non-admin user attempted to create admin account');
            return res.status(403).json({ message: 'Access denied. Only admins can create admin accounts.' });
        }

        const newAdmin = await adminService.createAdminUser({ username, email, password });
        log.info({ userId: newAdmin._id, username }, 'Admin user created successfully.');
        handleSuccess(res, {
            user: {
                id: newAdmin._id,
                username: newAdmin.username,
                email: newAdmin.email,
                role: newAdmin.role,
            },
        }, 'Admin user created successfully.', 201);
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function getAllUsers(req, res) {
    const log = req.log || logger;
    try {
        const users = await adminService.getAllUsersForAdmin();
        log.info({ count: users.length }, 'Retrieved all users for admin dashboard');
        handleSuccess(res, users);
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function updateUserRole(req, res) {
    const log = req.log || logger;
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role || !['user', 'admin'].includes(role)) {
            log.warn({ body: req.body }, 'Invalid role provided for user update.');
            return res.status(400).json({ message: 'Please provide a valid role (user or admin).' });
        }

        const updatedUser = await adminService.updateUserRoleForAdmin(userId, role);
        log.info({ userId, role }, 'User role updated successfully.');
        handleSuccess(res, {
            user: {
                id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
            },
        }, 'User role updated successfully.');
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function deleteUser(req, res) {
    const log = req.log || logger;
    try {
        const { userId } = req.params;
        await adminService.deleteUserForAdmin(userId);
        log.info({ userId }, 'User deleted successfully.');
        handleSuccess(res, null, 'User deleted successfully.');
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function getProgramAreas(req, res) {
    const log = req.log || logger;
    try {
        const programAreas = await adminService.getProgramAreasForAdmin();
        log.info({ count: programAreas.length }, 'Retrieved all program areas');
        handleSuccess(res, { programAreas }, 'Program areas retrieved successfully.');
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function getSpecialties(req, res) {
    const log = req.log || logger;
    try {
        const specialties = await adminService.getSpecialtiesForAdmin();
        log.info({ count: specialties.length }, 'Retrieved all specialties');
        handleSuccess(res, { specialties }, 'Specialties retrieved successfully.');
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function getAllCases(req, res) {
    const log = req.log || logger;
    try {
        const cases = await adminService.getAllCasesForAdmin();
        log.info({ count: cases.length }, 'Retrieved all cases for admin');
        handleSuccess(res, cases, 'Cases retrieved successfully.');
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function updateCase(req, res) {
    const log = req.log || logger;
    try {
        const { caseId } = req.params;
        const { programArea, specialty } = req.body;

        const updatedCase = await adminService.updateCaseForAdmin(caseId, { programArea, specialty });
        log.info({ caseId, programArea, specialty }, 'Case updated successfully.');
        handleSuccess(res, {
            id: updatedCase.case_metadata.case_id,
            title: updatedCase.case_metadata.title,
            programArea: updatedCase.case_metadata.program_area,
            specialty: updatedCase.case_metadata.specialty,
            difficulty: updatedCase.case_metadata.difficulty // Admin-only field
        }, 'Case updated successfully.');
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function deleteCase(req, res) {
    const log = req.log || logger;
    try {
        const { caseId } = req.params;
        await adminService.deleteCaseForAdmin(caseId);
        log.info({ caseId }, 'Case deleted successfully.');
        handleSuccess(res, null, 'Case deleted successfully.');
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function getUsersWithScores(req, res) {
    const log = req.log || logger;
    try {
        const usersWithScores = await adminService.getUsersWithScoresForAdmin();
        log.info({ count: usersWithScores.length }, 'Retrieved all users with scores');
        handleSuccess(res, usersWithScores);
    } catch (error) {
        handleError(res, error, log);
    }
}

export async function getSystemStats(req, res) {
    const log = req.log || logger;
    try {
        const systemStats = await adminService.getSystemStatsForAdmin();
        log.info('Retrieved system statistics for admin dashboard');
        handleSuccess(res, systemStats);
    } catch (error) {
        handleError(res, error, log);
    }
}

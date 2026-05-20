import Case from '../models/CaseModel.js';
import ProgramArea from '../models/ProgramAreaModel.js';
import Specialty from '../models/SpecialtyModel.js';
import { handleSuccess, handleError } from '../utils/responseHandler.js';

/**
 * Get all program areas
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getProgramAreas(req, res) {
    const log = req.log;
    try {
        // First try to get from ProgramArea model if it exists
        let programAreas = [];
        try {
            programAreas = await ProgramArea.find().select('name').lean();
            programAreas = programAreas.map(pa => pa.name);
        } catch (err) {
            // If ProgramArea model doesn't exist, get distinct program areas from cases
            log.info('ProgramArea model not found, getting from cases');
            programAreas = await Case.distinct('case_metadata.program_area');
        }
        
        // Filter out null/empty values and sort
        programAreas = programAreas
            .filter(area => area && area.trim() !== '')
            .sort();
        
        handleSuccess(res, { programAreas });
    } catch (error) {
        log.error(error, 'Error fetching program areas');
        handleError(res, { message: 'Failed to fetch program areas' }, log);
    }
}

/**
 * Add a new program area
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function addProgramArea(req, res) {
    const log = req.log;
    try {
        const { name } = req.body;
        
        if (!name || name.trim() === '') {
            return handleError(res, { message: 'Program area name is required' }, log);
        }
        
        // Check if program area already exists
        let exists = false;
        try {
            exists = await ProgramArea.exists({ name: name });
        } catch (err) {
            // If ProgramArea model doesn't exist, check in cases
            const programAreas = await Case.distinct('case_metadata.program_area');
            exists = programAreas.includes(name);
        }
        
        if (exists) {
            return handleError(res, { message: 'Program area already exists' }, log);
        }
        
        // Create new program area
        let newProgramArea;
        try {
            newProgramArea = new ProgramArea({ name });
            await newProgramArea.save();
        } catch (err) {
            log.error(err, 'Error creating program area in database');
            return handleError(res, { message: 'Failed to create program area' }, log);
        }
        
        handleSuccess(res, { 
            message: 'Program area created successfully',
            programArea: newProgramArea 
        });
    } catch (error) {
        log.error(error, 'Error adding program area');
        handleError(res, { message: 'Failed to add program area' }, log);
    }
}

/**
 * Update a program area
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateProgramArea(req, res) {
    const log = req.log;
    try {
        const { id } = req.params;
        const { name } = req.body;
        
        if (!name || name.trim() === '') {
            return handleError(res, { message: 'Program area name is required' }, log);
        }
        
        // Update program area
        let updatedProgramArea;
        try {
            updatedProgramArea = await ProgramArea.findByIdAndUpdate(
                id,
                { name },
                { new: true }
            );
            
            if (!updatedProgramArea) {
                return handleError(res, { message: 'Program area not found' }, log);
            }
            
            // Also update any cases using this program area
            // This is optional and depends on your data model
            // await Case.updateMany(
            //     { 'case_metadata.program_area': oldName },
            //     { $set: { 'case_metadata.program_area': name } }
            // );
            
        } catch (err) {
            log.error(err, 'Error updating program area in database');
            return handleError(res, { message: 'Failed to update program area' }, log);
        }
        
        handleSuccess(res, { 
            message: 'Program area updated successfully',
            programArea: updatedProgramArea 
        });
    } catch (error) {
        log.error(error, 'Error updating program area');
        handleError(res, { message: 'Failed to update program area' }, log);
    }
}

/**
 * Delete a program area
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deleteProgramArea(req, res) {
    const log = req.log;
    try {
        const { id } = req.params;
        
        // Get program area name before deleting
        let programAreaName;
        try {
            const programArea = await ProgramArea.findById(id);
            if (!programArea) {
                return handleError(res, { message: 'Program area not found' }, log);
            }
            programAreaName = programArea.name;
        } catch (err) {
            log.error(err, 'Error finding program area');
            return handleError(res, { message: 'Failed to find program area' }, log);
        }
        
        // Delete program area
        try {
            await ProgramArea.findByIdAndDelete(id);
            
            // Update any specialties using this program area to use "General"
            await Specialty.updateMany(
                { programArea: programAreaName },
                { $set: { programArea: 'General' } }
            );
            
        } catch (err) {
            log.error(err, 'Error deleting program area from database');
            return handleError(res, { message: 'Failed to delete program area' }, log);
        }
        
        handleSuccess(res, { 
            message: 'Program area deleted successfully',
            programAreaId: id 
        });
    } catch (error) {
        log.error(error, 'Error deleting program area');
        handleError(res, { message: 'Failed to delete program area' }, log);
    }
}

/**
 * Get all specialties
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getSpecialties(req, res) {
    const log = req.log;
    try {
        // Get all specialties with their active status from Specialty model
        let specialties = [];
        try {
            specialties = await Specialty.find().select('name programArea active').lean();
        } catch (err) {
            // If Specialty model doesn't exist, get distinct specialties from cases
            log.info('Specialty model not found, getting from cases');
            const specialtyNames = await Case.distinct('case_metadata.specialty');
            specialties = specialtyNames
                .filter(name => name && name.trim() !== '')
                .map(name => ({ 
                    name,
                    programArea: 'General',
                    active: true // Default to active for cases-derived specialties
                }));
        }
        
        // Filter out null/empty values and sort
        specialties = specialties
            .filter(specialty => specialty.name && specialty.name.trim() !== '')
            .sort((a, b) => a.name.localeCompare(b.name));
        
        handleSuccess(res, { specialties });
    } catch (error) {
        log.error(error, 'Error fetching specialties');
        handleError(res, { message: 'Failed to fetch specialties' }, log);
    }
}

/**
 * Add a new specialty
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function addSpecialty(req, res) {
    const log = req.log;
    try {
        const { name, programArea } = req.body;
        
        if (!name || name.trim() === '') {
            return handleError(res, { message: 'Specialty name is required' }, log);
        }
        
        if (!programArea || programArea.trim() === '') {
            return handleError(res, { message: 'Program area is required' }, log);
        }
        
        // Check if specialty already exists
        let exists = false;
        try {
            exists = await Specialty.exists({ name: name });
        } catch (err) {
            // If Specialty model doesn't exist, check in cases
            const specialties = await Case.distinct('case_metadata.specialty');
            exists = specialties.includes(name);
        }
        
        if (exists) {
            return handleError(res, { message: 'Specialty already exists' }, log);
        }
        
        // Create new specialty
        let newSpecialty;
        try {
            newSpecialty = new Specialty({ name, programArea });
            await newSpecialty.save();
        } catch (err) {
            log.error(err, 'Error creating specialty in database');
            return handleError(res, { message: 'Failed to create specialty' }, log);
        }
        
        handleSuccess(res, { 
            message: 'Specialty created successfully',
            specialty: newSpecialty 
        });
    } catch (error) {
        log.error(error, 'Error adding specialty');
        handleError(res, { message: 'Failed to add specialty' }, log);
    }
}

/**
 * Update a specialty
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function updateSpecialty(req, res) {
    const log = req.log;
    try {
        const { id } = req.params;
        const { name, programArea, active } = req.body;
        
        if (!name || name.trim() === '') {
            return handleError(res, { message: 'Specialty name is required' }, log);
        }
        
        if (!programArea || programArea.trim() === '') {
            return handleError(res, { message: 'Program area is required' }, log);
        }
        
        // Validate active field if provided
        if (active !== undefined && typeof active !== 'boolean') {
            return handleError(res, { message: 'Active field must be a boolean value' }, log);
        }
        
        // Update specialty
        let updatedSpecialty;
        try {
            const updateData = { name, programArea };
            if (active !== undefined) {
                updateData.active = active;
            }
            
            updatedSpecialty = await Specialty.findByIdAndUpdate(
                id,
                updateData,
                { new: true }
            );
            
            if (!updatedSpecialty) {
                return handleError(res, { message: 'Specialty not found' }, log);
            }
            
        } catch (err) {
            log.error(err, 'Error updating specialty in database');
            return handleError(res, { message: 'Failed to update specialty' }, log);
        }
        
        handleSuccess(res, { 
            message: 'Specialty updated successfully',
            specialty: updatedSpecialty 
        });
    } catch (error) {
        log.error(error, 'Error updating specialty');
        handleError(res, { message: 'Failed to update specialty' }, log);
    }
}

/**
 * Delete a specialty
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function deleteSpecialty(req, res) {
    const log = req.log;
    try {
        const { id } = req.params;
        
        // Delete specialty
        try {
            const result = await Specialty.findByIdAndDelete(id);
            
            if (!result) {
                return handleError(res, { message: 'Specialty not found' }, log);
            }
            
        } catch (err) {
            log.error(err, 'Error deleting specialty from database');
            return handleError(res, { message: 'Failed to delete specialty' }, log);
        }
        
        handleSuccess(res, { 
            message: 'Specialty deleted successfully',
            specialtyId: id 
        });
    } catch (error) {
        log.error(error, 'Error deleting specialty');
        handleError(res, { message: 'Failed to delete specialty' }, log);
    }
}

/**
 * Get program areas with case counts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getProgramAreasWithCounts(req, res) {
    const log = req.log;
    try {
        // Get all program areas
        let programAreas = [];
        try {
            programAreas = await ProgramArea.find().lean();
        } catch (err) {
            // If ProgramArea model doesn't exist, get distinct program areas from cases
            log.info('ProgramArea model not found, getting from cases');
            const programAreaNames = await Case.distinct('case_metadata.program_area');
            programAreas = programAreaNames
                .filter(name => name && name.trim() !== '')
                .map(name => ({ name }));
        }
        
        // Get case counts for each program area
        const programAreasWithCounts = await Promise.all(
            programAreas.map(async (pa) => {
                const count = await Case.countDocuments({ 'case_metadata.program_area': pa.name });
                return {
                    id: pa._id || `pa-${pa.name}`,
                    name: pa.name,
                    casesCount: count
                };
            })
        );
        
        handleSuccess(res, { programAreas: programAreasWithCounts });
    } catch (error) {
        log.error(error, 'Error fetching program areas with counts');
        handleError(res, { message: 'Failed to fetch program areas with counts' }, log);
    }
}

/**
 * Get specialties with case counts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getSpecialtiesWithCounts(req, res) {
    const log = req.log;
    try {
        console.log('Getting specialties with counts');
        // Get all specialties
        let specialties = [];
        try {
            console.log('Attempting to get specialties from Specialty model');
            specialties = await Specialty.find().lean();
            console.log(`Found ${specialties.length} specialties in Specialty model`);
        } catch (err) {
            console.error('Error getting specialties from Specialty model:', err);
            // If Specialty model doesn't exist, get distinct specialties from cases
            log.info('Specialty model not found, getting from cases');
            const specialtyNames = await Case.distinct('case_metadata.specialty');
            console.log(`Found ${specialtyNames.length} distinct specialties in cases`);
            specialties = specialtyNames
                .filter(name => name && name.trim() !== '')
                .map(name => ({ 
                    name,
                    // Assign a default program area since we don't know the actual one
                    programArea: 'General'
                }));
            console.log(`Mapped ${specialties.length} specialties from cases`);
        }
        
        // Get case counts for each specialty
        const specialtiesWithCounts = await Promise.all(
            specialties.map(async (spec) => {
                const count = await Case.countDocuments({ 'case_metadata.specialty': spec.name });
                return {
                    id: spec._id || `spec-${spec.name}`,
                    name: spec.name,
                    programArea: spec.programArea || 'General',
                    active: spec.active !== undefined ? spec.active : true,
                    casesCount: count
                };
            })
        );
        
        handleSuccess(res, { specialties: specialtiesWithCounts });
    } catch (error) {
        log.error(error, 'Error fetching specialties with counts');
        handleError(res, { message: 'Failed to fetch specialties with counts' }, log);
    }
}

/**
 * Toggle specialty visibility (active/inactive status)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function toggleSpecialtyVisibility(req, res) {
    const log = req.log;
    try {
        const { id } = req.params;
        
        // Get current specialty
        let specialty;
        try {
            specialty = await Specialty.findById(id);
            if (!specialty) {
                return handleError(res, { message: 'Specialty not found' }, log);
            }
        } catch (err) {
            log.error(err, 'Error finding specialty');
            return handleError(res, { message: 'Failed to find specialty' }, log);
        }
        
        // Toggle the active status
        const newActiveStatus = !specialty.active;
        
        try {
            const updatedSpecialty = await Specialty.findByIdAndUpdate(
                id,
                { active: newActiveStatus },
                { new: true }
            );
            
            const statusText = newActiveStatus ? 'shown to' : 'hidden from';
            
            handleSuccess(res, {
                message: `Specialty "${updatedSpecialty.name}" is now ${statusText} users`,
                specialty: updatedSpecialty
            });
        } catch (err) {
            log.error(err, 'Error updating specialty visibility');
            return handleError(res, { message: 'Failed to update specialty visibility' }, log);
        }
        
    } catch (error) {
        log.error(error, 'Error toggling specialty visibility');
        handleError(res, { message: 'Failed to toggle specialty visibility' }, log);
    }
}
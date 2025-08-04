import express from 'express';
import { 
  getProgramAreas, 
  addProgramArea, 
  updateProgramArea, 
  deleteProgramArea,
  getSpecialties,
  addSpecialty,
  updateSpecialty,
  deleteSpecialty,
  getProgramAreasWithCounts,
  getSpecialtiesWithCounts
} from '../controllers/adminProgramController.js';
import { protect, isAdmin } from '../middleware/jwtAuthMiddleware.js';

const router = express.Router();

// Program Area routes
router.get('/program-areas', getProgramAreas);
router.get('/program-areas/counts', getProgramAreasWithCounts);
router.post('/program-areas', protect, isAdmin, addProgramArea);
router.put('/program-areas/:id', protect, isAdmin, updateProgramArea);
router.delete('/program-areas/:id', protect, isAdmin, deleteProgramArea);

// Specialty routes
router.get('/specialties', getSpecialties);
router.get('/specialties/counts', getSpecialtiesWithCounts);
router.post('/specialties', protect, isAdmin, addSpecialty);
router.put('/specialties/:id', protect, isAdmin, updateSpecialty);
router.delete('/specialties/:id', protect, isAdmin, deleteSpecialty);

export default router;
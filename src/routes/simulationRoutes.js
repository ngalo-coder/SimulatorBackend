import express from 'express';
import { 
  getCases, 
  startSimulation, 
  handleAsk,
  endSession,
  getCaseCategories // Import the new controller function
} from '../controllers/simulationController.js';

const router = express.Router();

router.get('/cases', getCases);
router.get('/case-categories', getCaseCategories); // Add new route for categories
router.post('/start', startSimulation);
router.get('/ask', handleAsk);
router.post('/end', endSession);  // End session endpoint

export default router;
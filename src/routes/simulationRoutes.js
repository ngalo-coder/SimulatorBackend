import express from 'express';
import { 
  getCases, 
  startSimulation, 
  handleAsk,
  endSession 
} from '../controllers/simulationController.js';

const router = express.Router();

router.get('/cases', getCases);
router.post('/start', startSimulation);
router.get('/ask', handleAsk);
router.post('/end', endSession);  // End session endpoint

export default router;
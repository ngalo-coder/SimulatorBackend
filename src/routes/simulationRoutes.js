import express from 'express';
import { startSimulation, handleAsk, getAllCases } from '../controllers/simulationController.js';

const router = express.Router();

router.post('/start', startSimulation);

// CHANGE THIS LINE FROM .post to .get
router.post('/ask', handleAsk);

// Route to get all cases
router.get('/cases', getAllCases);

export default router;
import express from 'express';
import { getCases, startSimulation, handleAsk } from '../controllers/simulationController.js';

const router = express.Router();

router.get('/cases', getCases); // List all cases
router.post('/start', startSimulation);
router.post('/ask', handleAsk);

export default router;
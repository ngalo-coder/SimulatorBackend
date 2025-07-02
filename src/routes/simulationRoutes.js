import express from 'express';
import { startSimulation, handleAsk } from '../controllers/simulationController.js';

const router = express.Router();

router.post('/start', startSimulation);

// CHANGE THIS LINE FROM .post to .get
router.get('/ask', handleAsk);

export default router;
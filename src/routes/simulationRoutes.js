import express from 'express';
import { startSimulation, handleAsk } from '../controllers/simulationController.js';

const router = express.Router();

router.post('/start', startSimulation);
router.post('/ask', handleAsk);

export default router;
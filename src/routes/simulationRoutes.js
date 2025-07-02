// src/routes/simulationRoutes.js
const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');

// Route to start a new simulation
router.post('/start', simulationController.startSimulation);

// Route to ask a question within a simulation
router.post('/ask', simulationController.handleAsk);

module.exports = router;
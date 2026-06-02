const express = require('express');
const { startSession, chat, endSimulation } = require('../controllers/simulationController');
const router = express.Router();

router.post('/start', startSession);
router.post('/chat', chat);
router.post('/end', endSimulation);

module.exports = router;

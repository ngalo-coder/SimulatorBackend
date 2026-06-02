const express = require('express');
const { getSpecialties, getCases } = require('../controllers/caseController');
const router = express.Router();

router.get('/specialties', getSpecialties);
router.get('/', getCases);

module.exports = router;

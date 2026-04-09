const express = require('express');
const AnalysisController = require('../controllers/analysisController');

const router = express.Router();
router.get('/education-supply', AnalysisController.getEducationSupply);

module.exports = router;
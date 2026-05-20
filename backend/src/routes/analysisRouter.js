const express = require('express');
const AnalysisController = require('../controllers/analysisController');

const router = express.Router();
router.get('/education-supply', AnalysisController.getEducationSupply);
router.get('/recommend-sites', AnalysisController.getRecommendedSites);

module.exports = router;
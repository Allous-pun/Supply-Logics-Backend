const express = require('express');
const router = express.Router();
const {
  calculateCO2Emission,
  getCO2Emissions,
  calculateLocalSupplierScore,
  getLocalSupplierScores,
  recordPackagingWaste,
  getPackagingWasteAnalytics,
  generateWasteReductionSuggestions,
  getWasteReductionSuggestions,
  implementSuggestion,
  getSustainabilityDashboard
} = require('../controllers/sustainability.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// CO2 Emissions
router.post('/co2/calculate', calculateCO2Emission);
router.get('/co2', getCO2Emissions);

// Local Supplier Scoring
router.post('/suppliers/score', calculateLocalSupplierScore);
router.get('/suppliers/scores', getLocalSupplierScores);

// Packaging Waste
router.post('/packaging-waste', recordPackagingWaste);
router.get('/packaging-waste/analytics', getPackagingWasteAnalytics);

// Waste Reduction Suggestions
router.post('/suggestions/generate', generateWasteReductionSuggestions);
router.get('/suggestions', getWasteReductionSuggestions);
router.post('/suggestions/:id/implement', implementSuggestion);

// Sustainability Dashboard
router.get('/dashboard', getSustainabilityDashboard);

module.exports = router;

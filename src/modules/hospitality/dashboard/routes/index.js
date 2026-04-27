const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getSpendAnalytics,
  getInventoryAnalytics,
  getBranchPerformance,
  getSupplierPerformanceReport,
  getTrendAnalytics,
  getKPISummary
} = require('../controllers/dashboard.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Main Dashboard
router.get('/', getDashboard);

// Analytics
router.get('/spend', getSpendAnalytics);
router.get('/inventory', getInventoryAnalytics);
router.get('/branches', getBranchPerformance);
router.get('/suppliers', getSupplierPerformanceReport);
router.get('/trends', getTrendAnalytics);
router.get('/kpis', getKPISummary);

module.exports = router;

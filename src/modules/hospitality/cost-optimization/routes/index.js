const express = require('express');
const router = express.Router();
const {
  predictPriceTrend,
  getPriceTrends,
  forecastDemand,
  getDemandForecasts,
  predictStockoutRisk,
  recordWastage,
  getWastageAnalytics,
  getCheapestSupplier,
  detectSpendingAnomalies
} = require('../controllers/cost-optimization.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Price Trends
router.post('/price-trend/predict', predictPriceTrend);
router.get('/price-trends', getPriceTrends);

// Demand Forecasting
router.post('/demand/forecast', forecastDemand);
router.get('/demand/forecasts', getDemandForecasts);

// Stockout Risk
router.get('/stockout-risk', predictStockoutRisk);

// Wastage
router.post('/wastage', recordWastage);
router.get('/wastage/analytics', getWastageAnalytics);

// Supplier Optimization
router.get('/cheapest-supplier', getCheapestSupplier);

// Anomaly Detection
router.get('/spending-anomalies', detectSpendingAnomalies);

module.exports = router;

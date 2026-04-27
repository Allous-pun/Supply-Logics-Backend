const express = require('express');
const router = express.Router();
const {
  // Base CRUD
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  // Price History
  recordPriceChange,
  getPriceHistory,
  // Performance
  calculateSupplierPerformance,
  getSupplierPerformance,
  // Comparison
  compareSuppliers,
  getSupplierScorecard
} = require('../controllers/supplier.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Base CRUD
router.post('/', createSupplier);
router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

// Price History
router.post('/price-history', recordPriceChange);
router.get('/price-history', getPriceHistory);

// Performance
router.post('/performance', calculateSupplierPerformance);
router.get('/:supplierId/performance', getSupplierPerformance);

// Comparison & Scorecard
router.get('/compare', compareSuppliers);
router.get('/:supplierId/scorecard', getSupplierScorecard);

module.exports = router;

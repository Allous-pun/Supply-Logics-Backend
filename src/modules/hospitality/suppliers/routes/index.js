const express = require('express');
const router = express.Router();
const {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  recordPriceChange,
  getPriceHistory,
  calculateSupplierPerformance,
  getSupplierPerformance,
  compareSuppliers,
  getSupplierScorecard
} = require('../controllers/supplier.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// ==================== STATIC ROUTES (no :id parameter) ====================
router.get('/compare', compareSuppliers);
router.get('/price-history', getPriceHistory);
router.post('/price-history', recordPriceChange);
router.post('/performance', calculateSupplierPerformance);

// ==================== DYNAMIC ROUTES (with :id parameter) - MUST COME LAST ====================
router.post('/', createSupplier);
router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);
router.get('/:supplierId/performance', getSupplierPerformance);
router.get('/:supplierId/scorecard', getSupplierScorecard);

module.exports = router;
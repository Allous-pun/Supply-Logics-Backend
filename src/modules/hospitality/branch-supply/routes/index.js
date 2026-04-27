const express = require('express');
const router = express.Router();
const {
  // Branch Stock
  getBranchStock,
  getBranchStockByItem,
  updateBranchStock,
  // Stock Requests / Transfers
  createStockRequest,
  getStockRequests,
  // Branch Reports
  getBranchComparison,
  getBranchInventoryValue,
  getBranchReorderSuggestions
} = require('../controllers/branch-supply.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Branch Stock
router.get('/stock', getBranchStock);
router.get('/stock/item/:itemId', getBranchStockByItem);
router.put('/stock', updateBranchStock);

// Stock Transfers
router.post('/transfers', createStockRequest);
router.get('/transfers', getStockRequests);

// Branch Reports
router.get('/comparison', getBranchComparison);
router.get('/:branchId/inventory-value', getBranchInventoryValue);
router.get('/:branchId/reorder-suggestions', getBranchReorderSuggestions);

module.exports = router;

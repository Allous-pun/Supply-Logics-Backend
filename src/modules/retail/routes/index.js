const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  updateProduct,
  updateBranchStock,
  getBranchStock,
  createTransfer,
  approveTransfer,
  completeTransfer,
  getTransfers,
  generateReorderSuggestions,
  getRetailDashboard
} = require('../controllers/retail.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Products
router.post('/products', createProduct);
router.get('/products', getProducts);
router.put('/products/:id', updateProduct);

// Branch Stock
router.put('/branch-stock', updateBranchStock);
router.get('/branch-stock', getBranchStock);

// Transfers
router.post('/transfers', createTransfer);
router.post('/transfers/:id/approve', approveTransfer);
router.post('/transfers/:id/complete', completeTransfer);
router.get('/transfers', getTransfers);

// Reorder Engine
router.post('/reorder/suggestions', generateReorderSuggestions);

// Dashboard
router.get('/dashboard', getRetailDashboard);

module.exports = router;

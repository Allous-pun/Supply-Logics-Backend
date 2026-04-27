const express = require('express');
const router = express.Router();
const {
  // Purchase Requests
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  approvePurchaseRequest,
  // Purchase Orders
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updateOrderStatus,
  // Goods Receipt
  createGoodsReceipt,
  getGoodsReceipts,
  // Reorder Suggestions
  getReorderSuggestions,
  createReorderSuggestions
} = require('../controllers/procurement.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Purchase Requests
router.post('/requests', createPurchaseRequest);
router.get('/requests', getPurchaseRequests);
router.get('/requests/:id', getPurchaseRequestById);
router.post('/requests/:id/approve', approvePurchaseRequest);

// Purchase Orders
router.post('/orders', createPurchaseOrder);
router.get('/orders', getPurchaseOrders);
router.get('/orders/:id', getPurchaseOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

// Goods Receipt Notes
router.post('/receipts', createGoodsReceipt);
router.get('/receipts', getGoodsReceipts);

// Reorder Suggestions
router.get('/suggestions/reorder', getReorderSuggestions);
router.post('/suggestions/reorder', createReorderSuggestions);

module.exports = router;

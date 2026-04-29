const express = require('express');
const router = express.Router();
const {
  // Categories
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Items
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  // Movements
  receiveStock,
  issueStock,
  adjustStock,
  getMovements,  // ADDED
  // Alerts
  getLowStockAlerts,
  resolveAlert,
  // Branch Stock
  getBranchStock
} = require('../controllers/inventory.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

// All inventory routes require orgCode and authentication
router.use(validateOrgCode, authenticate);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Items
router.get('/items', getItems);
router.get('/items/:id', getItemById);
router.post('/items', createItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

// Stock Movements
router.post('/movements/receive', receiveStock);
router.post('/movements/issue', issueStock);
router.post('/movements/adjust', adjustStock);
router.get('/movements', getMovements);  // ADDED - GET endpoint for movements

// Alerts
router.get('/alerts/low-stock', getLowStockAlerts);
router.post('/alerts/:id/resolve', resolveAlert);

// Branch Stock
router.get('/branches/:branchId/stock', getBranchStock);

module.exports = router;
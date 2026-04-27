const express = require('express');
const router = express.Router();
const {
  createRawMaterial,
  getRawMaterials,
  createWorkOrder,
  getWorkOrders,
  updateWorkOrderStatus,
  recordMaterialUsage,
  recordFinishedGoodsOutput,
  createFinishedGoods,
  getFinishedGoods,
  createDispatch,
  getDispatches,
  updateDispatchStatus,
  getManufacturingDashboard
} = require('../controllers/manufacturing.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Raw Materials
router.post('/raw-materials', createRawMaterial);
router.get('/raw-materials', getRawMaterials);

// Work Orders
router.post('/work-orders', createWorkOrder);
router.get('/work-orders', getWorkOrders);
router.patch('/work-orders/:id/status', updateWorkOrderStatus);

// Production
router.post('/production/usage', recordMaterialUsage);
router.post('/production/output', recordFinishedGoodsOutput);

// Finished Goods
router.post('/finished-goods', createFinishedGoods);
router.get('/finished-goods', getFinishedGoods);

// Dispatch
router.post('/dispatch', createDispatch);
router.get('/dispatch', getDispatches);
router.patch('/dispatch/:id/status', updateDispatchStatus);

// Dashboard
router.get('/dashboard', getManufacturingDashboard);

module.exports = router;

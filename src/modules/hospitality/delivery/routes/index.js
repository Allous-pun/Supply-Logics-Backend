const express = require('express');
const router = express.Router();
const {
  createSupplierDelivery,
  getSupplierDeliveries,
  updateDeliveryStatus,
  createInterBranchDelivery,
  getInterBranchDeliveries,
  updateInterBranchDeliveryStatus,
  getDeliveryCalendar,
  getDeliveryAlerts,
  resolveAlert,
  predictETA
} = require('../controllers/delivery.controller');
const { authenticate } = require('../../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Supplier Deliveries
router.post('/supplier', createSupplierDelivery);
router.get('/supplier', getSupplierDeliveries);
router.patch('/supplier/:id/status', updateDeliveryStatus);

// Inter-Branch Deliveries
router.post('/branch', createInterBranchDelivery);
router.get('/branch', getInterBranchDeliveries);
router.patch('/branch/:id/status', updateInterBranchDeliveryStatus);

// Calendar
router.get('/calendar', getDeliveryCalendar);

// Alerts
router.get('/alerts', getDeliveryAlerts);
router.post('/alerts/:id/resolve', resolveAlert);

// ETA Prediction
router.post('/eta/predict', predictETA);

module.exports = router;

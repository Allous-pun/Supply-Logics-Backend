const express = require('express');
const router = express.Router();
const {
  createMedicalItem,
  getMedicalItems,
  recordColdChainLog,
  getColdChainLogs,
  checkExpiryAlerts,
  resolveExpiryAlert,
  createEmergencyReorder,
  getEmergencyReorders,
  approveEmergencyReorder,
  getHealthcareDashboard
} = require('../controllers/healthcare.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Medical Inventory
router.post('/medical-items', createMedicalItem);
router.get('/medical-items', getMedicalItems);

// Cold Chain
router.post('/cold-chain/logs', recordColdChainLog);
router.get('/cold-chain/logs', getColdChainLogs);

// Expiry Alerts
router.get('/expiry-alerts', checkExpiryAlerts);
router.post('/expiry-alerts/:id/resolve', resolveExpiryAlert);

// Emergency Reorders
router.post('/emergency-reorders', createEmergencyReorder);
router.get('/emergency-reorders', getEmergencyReorders);
router.post('/emergency-reorders/:id/approve', approveEmergencyReorder);

// Dashboard
router.get('/dashboard', getHealthcareDashboard);

module.exports = router;

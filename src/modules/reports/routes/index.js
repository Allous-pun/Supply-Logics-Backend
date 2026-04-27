const express = require('express');
const router = express.Router();
const {
  generateInventoryReport,
  generateProcurementReport,
  generateSupplierReport,
  generateStockMovementReport,
  generateWastageReport,
  generateFinancialReport
} = require('../controllers/report.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

router.get('/inventory', generateInventoryReport);
router.get('/procurement', generateProcurementReport);
router.get('/suppliers', generateSupplierReport);
router.get('/stock-movements', generateStockMovementReport);
router.get('/wastage', generateWastageReport);
router.get('/financial', generateFinancialReport);

module.exports = router;

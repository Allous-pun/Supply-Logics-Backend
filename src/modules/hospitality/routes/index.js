const express = require('express');
const router = express.Router();

const inventoryRoutes = require('../inventory/routes');
const procurementRoutes = require('../procurement/routes');
const supplierRoutes = require('../suppliers/routes');
const branchSupplyRoutes = require('../branch-supply/routes');
const deliveryRoutes = require('../delivery/routes');
const costOptimizationRoutes = require('../cost-optimization/routes');
const sustainabilityRoutes = require('../sustainability/routes');
const dashboardRoutes = require('../dashboard/routes');

router.use('/inventory', inventoryRoutes);
router.use('/procurement', procurementRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/branch-supply', branchSupplyRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/cost-optimization', costOptimizationRoutes);
router.use('/sustainability', sustainabilityRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;

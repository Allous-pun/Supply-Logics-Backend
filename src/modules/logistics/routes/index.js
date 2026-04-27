const express = require('express');
const router = express.Router();
const {
  createVehicle,
  getVehicles,
  updateVehicleStatus,
  createRoute,
  getRoutes,
  createDriver,
  getDrivers,
  assignDriverToVehicle,
  createTrip,
  completeTrip,
  addTripPayment,
  addFuelLog,
  getFuelEfficiency,
  addMaintenance,
  addTrafficData,
  optimizeRoute,
  getLogisticsDashboard
} = require('../controllers/logistics.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Vehicles
router.post('/vehicles', createVehicle);
router.get('/vehicles', getVehicles);
router.patch('/vehicles/:id/status', updateVehicleStatus);

// Routes
router.post('/routes', createRoute);
router.get('/routes', getRoutes);

// Drivers
router.post('/drivers', createDriver);
router.get('/drivers', getDrivers);
router.post('/drivers/assign', assignDriverToVehicle);

// Trips
router.post('/trips', createTrip);
router.post('/trips/:id/complete', completeTrip);
router.post('/trips/payment', addTripPayment);

// Fuel
router.post('/fuel', addFuelLog);
router.get('/fuel/efficiency', getFuelEfficiency);

// Maintenance
router.post('/maintenance', addMaintenance);

// Route Optimization
router.post('/traffic', addTrafficData);
router.post('/routes/optimize', optimizeRoute);

// Dashboard
router.get('/dashboard', getLogisticsDashboard);

module.exports = router;

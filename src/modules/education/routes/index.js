const express = require('express');
const router = express.Router();
const {
  createBook,
  getBooks,
  distributeBook,
  returnBook,
  createStationeryItem,
  getStationeryItems,
  createUniformItem,
  getUniformItems,
  createCafeteriaSupply,
  getCafeteriaSupplies,
  recordMealConsumption,
  createHostelSupply,
  getHostelSupplies,
  allocateToRoom,
  getEducationDashboard
} = require('../controllers/education.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

router.use(validateOrgCode, authenticate);

// Books
router.post('/books', createBook);
router.get('/books', getBooks);
router.post('/books/distribute', distributeBook);
router.post('/books/:id/return', returnBook);

// Stationery
router.post('/stationery', createStationeryItem);
router.get('/stationery', getStationeryItems);

// Uniforms
router.post('/uniforms', createUniformItem);
router.get('/uniforms', getUniformItems);

// Cafeteria
router.post('/cafeteria/supplies', createCafeteriaSupply);
router.get('/cafeteria/supplies', getCafeteriaSupplies);
router.post('/cafeteria/consumption', recordMealConsumption);

// Hostel
router.post('/hostel/supplies', createHostelSupply);
router.get('/hostel/supplies', getHostelSupplies);
router.post('/hostel/allocate', allocateToRoom);

// Dashboard
router.get('/dashboard', getEducationDashboard);

module.exports = router;

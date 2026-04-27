const express = require('express');
const router = express.Router();
const {
  getAllIndustries,
  getIndustryByKey,
  getIndustryModules
} = require('../controllers/industry.controller');

// Public routes - no authentication needed
router.get('/', getAllIndustries);
router.get('/:key', getIndustryByKey);
router.get('/:key/modules', getIndustryModules);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  updateCurrency,
  updateRegional,
  resetSettings
} = require('../controllers/settings.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

// All settings routes require orgCode and authentication
router.use(validateOrgCode, authenticate);

router.get('/', getSettings);
router.put('/', updateSettings);
router.put('/currency', updateCurrency);
router.put('/regional', updateRegional);
router.post('/reset', resetSettings);

module.exports = router;

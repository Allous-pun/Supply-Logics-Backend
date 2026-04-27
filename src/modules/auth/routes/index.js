const express = require('express');
const router = express.Router();
const { registerOwner, login, getProfile } = require('../controllers/auth.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

// Public routes
router.post('/register-owner', registerOwner);
router.post('/login', login);

// Protected routes
router.get('/profile', validateOrgCode, authenticate, getProfile);

module.exports = router;

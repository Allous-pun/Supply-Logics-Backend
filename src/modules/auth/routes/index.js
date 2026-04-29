const express = require('express');
const router = express.Router();
const { registerOwner, login, getProfile } = require('../controllers/auth.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

// Public routes
router.post('/register-owner', registerOwner);
router.post('/login', login);  // No validateOrgCode middleware

// Protected routes
router.get('/profile', authenticate, getProfile);  // No validateOrgCode needed, token has orgCode

module.exports = router;
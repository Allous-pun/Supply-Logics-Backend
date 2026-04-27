const express = require('express');
const router = express.Router();
const { upload, uploadOrganizationLogo, uploadUserAvatar } = require('../controllers/upload.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');

router.post('/organization/logo', authenticate, upload.single('logo'), uploadOrganizationLogo);
router.post('/users/:userId/avatar', authenticate, upload.single('avatar'), uploadUserAvatar);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  regenerateLoginCode,
  uploadAvatar
} = require('../controllers/user.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');
const upload = require('../../../middlewares/upload.middleware');

// All user routes require orgCode and authentication
router.use(validateOrgCode, authenticate);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/regenerate-code', regenerateLoginCode);
router.post('/:id/avatar', upload.single('avatar'), uploadAvatar);

module.exports = router;

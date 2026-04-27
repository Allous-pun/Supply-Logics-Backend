const express = require('express');
const router = express.Router();
const {
  getRoles,
  getPermissions,
  getPermissionsByModule,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles
} = require('../controllers/rbac.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');

// All RBAC routes require orgCode and authentication
router.use(validateOrgCode, authenticate);

// Roles
router.get('/industries/:industryKey/roles', getRoles);
router.post('/roles', createRole);
router.put('/roles/:id', updateRole);
router.delete('/roles/:id', deleteRole);

// Permissions
router.get('/permissions', getPermissions);
router.get('/permissions/module/:moduleKey', getPermissionsByModule);

// User role assignments
router.get('/users/:userId/roles', getUserRoles);
router.post('/users/assign-role', assignRoleToUser);
router.delete('/users/:userId/roles/:roleId', removeRoleFromUser);

module.exports = router;

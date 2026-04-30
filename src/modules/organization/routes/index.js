const express = require('express');
const router = express.Router();
const {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  getMyOrganization,
  updateOrganization,
  deleteOrganization,
  getEnabledModules,
  toggleModule,
  getOrganizationLocation,
  updateOrganizationLocation
} = require('../controllers/organization.controller');

// Public route - no auth needed
router.post('/', createOrganization);

// Protected routes (require authentication)
router.get('/', getOrganizations);
router.get('/my-organization', getMyOrganization);
router.get('/my-organization/location', getOrganizationLocation);
router.put('/my-organization/location', updateOrganizationLocation);
router.get('/:id', getOrganizationById);
router.put('/:id', updateOrganization);
router.delete('/:id', deleteOrganization);
router.get('/modules/enabled', getEnabledModules);
router.patch('/modules/:moduleKey/toggle', toggleModule);

module.exports = router;
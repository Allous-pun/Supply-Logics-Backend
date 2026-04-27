const express = require('express');
const router = express.Router();
const {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
  assignStaffToBranch,
  removeStaffFromBranch
} = require('../controllers/branch.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validateOrgCode = require('../../../middlewares/orgCode.middleware');
const { restrictToUserBranches, filterByUserBranches } = require('../../../middlewares/branch.middleware');

// All branch routes require orgCode and authentication
router.use(validateOrgCode, authenticate, restrictToUserBranches);

router.post('/', createBranch);
router.get('/', getBranches);
router.get('/:id', getBranchById);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);
router.post('/assign-staff', assignStaffToBranch);
router.delete('/:branchId/staff/:userId', removeStaffFromBranch);

module.exports = router;

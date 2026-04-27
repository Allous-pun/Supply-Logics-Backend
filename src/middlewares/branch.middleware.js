const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Restrict access to only the user's assigned branches
const restrictToUserBranches = async (req, res, next) => {
  const userId = req.user.userId;
  const orgCode = req.headers['x-org-code'];
  
  // Check if user has BRANCH_MANAGER role
  const hasBranchManagerRole = req.user.roles?.includes('HOSP_BRANCH_MANAGER');
  
  if (!hasBranchManagerRole) {
    return next();
  }
  
  // Get user's assigned branches
  const branchStaff = await prisma.branchStaff.findMany({
    where: { userId },
    include: { branch: true }
  });
  
  const userBranchIds = branchStaff.map(bs => bs.branchId);
  
  // Attach to request for use in controllers
  req.userBranchIds = userBranchIds;
  req.isBranchManager = true;
  
  next();
};

// Filter query by user's branches
const filterByUserBranches = (req, res, next) => {
  if (req.userBranchIds && req.userBranchIds.length > 0) {
    // Modify the query to only include user's branches
    req.branchFilter = {
      id: { in: req.userBranchIds }
    };
  }
  next();
};

module.exports = {
  restrictToUserBranches,
  filterByUserBranches
};

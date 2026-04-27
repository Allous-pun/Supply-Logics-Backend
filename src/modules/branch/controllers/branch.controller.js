const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generateBranchCode = (name) => {
  const codes = {
    'nairobi': 'ZGN',
    'kisumu': 'ZGK', 
    'mombasa': 'ZGM'
  };
  return codes[name.toLowerCase()] || name.substring(0, 3).toUpperCase();
};

const createBranch = async (req, res) => {
  try {
    const { name, address, phone, email, managerId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const branchCode = generateBranchCode(name);
    
    const branch = await prisma.branch.create({
      data: {
        name,
        code: branchCode,
        organizationId: organization.id,
        address,
        phone,
        email,
        managerId
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });
    
    res.status(201).json({
      message: 'Branch created successfully',
      branch
    });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getBranches = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const isBranchManager = req.isBranchManager;
    const userBranchIds = req.userBranchIds;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    
    // If branch manager, only show their assigned branches
    if (isBranchManager && userBranchIds && userBranchIds.length > 0) {
      whereClause.id = { in: userBranchIds };
    }
    
    const branches = await prisma.branch.findMany({
      where: whereClause,
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: { staff: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgCode = req.headers['x-org-code'];
    const isBranchManager = req.isBranchManager;
    const userBranchIds = req.userBranchIds;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Check if branch manager has access to this branch
    if (isBranchManager && userBranchIds && !userBranchIds.includes(id)) {
      return res.status(403).json({ error: 'Access denied to this branch' });
    }
    
    const branch = await prisma.branch.findFirst({
      where: {
        id,
        organizationId: organization.id
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        staff: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        inventory: true
      }
    });
    
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, email, managerId, isActive } = req.body;
    const orgCode = req.headers['x-org-code'];
    const isBranchManager = req.isBranchManager;
    const userBranchIds = req.userBranchIds;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Check if branch manager has access to this branch
    if (isBranchManager && userBranchIds && !userBranchIds.includes(id)) {
      return res.status(403).json({ error: 'Access denied to this branch' });
    }
    
    const updateData = { address, phone, email, managerId, isActive };
    if (name) {
      updateData.name = name;
      updateData.code = generateBranchCode(name);
    }
    
    const branch = await prisma.branch.updateMany({
      where: {
        id,
        organizationId: organization.id
      },
      data: updateData
    });
    
    res.json({
      message: 'Branch updated successfully',
      branch
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const orgCode = req.headers['x-org-code'];
    const isBranchManager = req.isBranchManager;
    const userBranchIds = req.userBranchIds;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Only owner can delete branches (branch managers cannot)
    if (isBranchManager) {
      return res.status(403).json({ error: 'Branch managers cannot delete branches' });
    }
    
    await prisma.branch.deleteMany({
      where: {
        id,
        organizationId: organization.id
      }
    });
    
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const assignStaffToBranch = async (req, res) => {
  try {
    const { branchId, userId, role } = req.body;
    const orgCode = req.headers['x-org-code'];
    const isBranchManager = req.isBranchManager;
    const userBranchIds = req.userBranchIds;
    
    // Check if branch manager has access to this branch
    if (isBranchManager && userBranchIds && !userBranchIds.includes(branchId)) {
      return res.status(403).json({ error: 'Access denied to this branch' });
    }
    
    const branchStaff = await prisma.branchStaff.upsert({
      where: {
        branchId_userId: {
          branchId,
          userId
        }
      },
      update: { role },
      create: {
        branchId,
        userId,
        role
      }
    });
    
    res.json({
      message: 'Staff assigned to branch successfully',
      branchStaff
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeStaffFromBranch = async (req, res) => {
  try {
    const { branchId, userId } = req.params;
    const orgCode = req.headers['x-org-code'];
    const isBranchManager = req.isBranchManager;
    const userBranchIds = req.userBranchIds;
    
    // Check if branch manager has access to this branch
    if (isBranchManager && userBranchIds && !userBranchIds.includes(branchId)) {
      return res.status(403).json({ error: 'Access denied to this branch' });
    }
    
    await prisma.branchStaff.deleteMany({
      where: {
        branchId,
        userId
      }
    });
    
    res.json({ message: 'Staff removed from branch successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
  assignStaffToBranch,
  removeStaffFromBranch
};

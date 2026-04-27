const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all roles for an industry
const getRoles = async (req, res) => {
  try {
    const { industryCode } = req.params;
    
    const industry = await prisma.industry.findUnique({
      where: { code: industryCode },
      include: {
        roles: {
          include: {
            permissions: true
          }
        }
      }
    });
    
    if (!industry) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    
    res.json(industry.roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get organization roles based on industry
const getOrganizationRoles = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    // First find the organization with its industry
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        industry: {
          include: {
            roles: {
              where: { isActive: true },
              include: {
                permissions: true
              }
            }
          }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json(organization.industry?.roles || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user's permissions
const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        user: { orgCode }
      },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });
    
    const permissions = [];
    for (const userRole of userRoles) {
      for (const perm of userRole.role.permissions) {
        permissions.push({
          moduleCode: perm.moduleCode,
          action: perm.action,
          resource: perm.resource,
          roleId: userRole.roleId,
          roleName: userRole.role.name,
          moduleId: userRole.moduleId
        });
      }
    }
    
    // Remove duplicates if any
    const uniquePermissions = permissions.filter((perm, index, self) => 
      index === self.findIndex(p => 
        p.moduleCode === perm.moduleCode && 
        p.action === perm.action && 
        p.resource === perm.resource
      )
    );
    
    res.json(uniquePermissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Assign role to user
const assignRole = async (req, res) => {
  try {
    const { userId, roleId, moduleId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        orgCode
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if role assignment already exists
    const existingAssignment = await prisma.userRoleAssignment.findUnique({
      where: {
        userId_roleId_moduleId: {
          userId,
          roleId,
          moduleId: moduleId || null
        }
      }
    });
    
    if (existingAssignment) {
      return res.status(400).json({ error: 'Role already assigned to user' });
    }
    
    const userRole = await prisma.userRoleAssignment.create({
      data: {
        userId,
        roleId,
        moduleId
      },
      include: {
        role: {
          include: {
            permissions: true
          }
        },
        module: true
      }
    });
    
    res.json({
      success: true,
      message: 'Role assigned successfully',
      userRole
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove role from user
const removeRole = async (req, res) => {
  try {
    const { userRoleId } = req.params;
    
    const userRole = await prisma.userRoleAssignment.findUnique({
      where: { id: userRoleId }
    });
    
    if (!userRole) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }
    
    await prisma.userRoleAssignment.delete({
      where: { id: userRoleId }
    });
    
    res.json({ 
      success: true,
      message: 'Role removed successfully' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user's assigned roles
const getUserRoles = async (req, res) => {
  try {
    const { userId } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        user: { orgCode }
      },
      include: {
        role: {
          include: {
            permissions: true
          }
        },
        module: true
      }
    });
    
    res.json(userRoles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Check if user has permission
const checkPermission = async (req, res) => {
  try {
    const { userId, moduleCode, action, resource } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        user: { orgCode }
      },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });
    
    let hasPermission = false;
    let matchedPermissions = [];
    
    for (const userRole of userRoles) {
      for (const perm of userRole.role.permissions) {
        const moduleMatches = perm.moduleCode === '*' || perm.moduleCode === moduleCode;
        const actionMatches = perm.action === '*' || perm.action === action;
        const resourceMatches = !perm.resource || perm.resource === resource || perm.resource === '*';
        
        if (moduleMatches && actionMatches && resourceMatches) {
          hasPermission = true;
          matchedPermissions.push({
            roleId: userRole.roleId,
            roleName: userRole.role.name,
            permission: perm
          });
        }
      }
      if (hasPermission) break;
    }
    
    res.json({ 
      hasPermission,
      matchedPermissions: matchedPermissions.length > 0 ? matchedPermissions : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new role
const createRole = async (req, res) => {
  try {
    const { name, code, description, industryId, permissions } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    // Verify organization and industry
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: { industry: true }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    if (organization.industryId !== industryId) {
      return res.status(400).json({ error: 'Industry does not match organization' });
    }
    
    const role = await prisma.role.create({
      data: {
        name,
        code,
        description,
        industryId,
        permissions: permissions ? {
          create: permissions
        } : undefined
      },
      include: {
        permissions: true
      }
    });
    
    res.json({
      success: true,
      message: 'Role created successfully',
      role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update role
const updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { name, description, isActive, permissions } = req.body;
    
    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        name,
        description,
        isActive,
        permissions: permissions ? {
          deleteMany: {},
          create: permissions
        } : undefined
      },
      include: {
        permissions: true
      }
    });
    
    res.json({
      success: true,
      message: 'Role updated successfully',
      role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete role
const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    
    // Check if role has any user assignments
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { roleId }
    });
    
    if (assignments.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role with active user assignments' 
      });
    }
    
    await prisma.role.delete({
      where: { id: roleId }
    });
    
    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getRoles,
  getOrganizationRoles,
  getUserPermissions,
  getUserRoles,
  assignRole,
  removeRole,
  checkPermission,
  createRole,
  updateRole,
  deleteRole
};
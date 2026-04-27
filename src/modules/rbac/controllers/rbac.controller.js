const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all roles for an industry
const getRoles = async (req, res) => {
  try {
    const { industryKey } = req.params;
    
    const industry = await prisma.industry.findUnique({
      where: { key: industryKey },
      include: {
        roles: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });
    
    if (!industry) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    
    const roles = industry.roles.map(role => ({
      id: role.id,
      name: role.name,
      key: role.key,
      description: role.description,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        moduleKey: rp.permission.moduleKey,
        action: rp.permission.action,
        description: rp.permission.description
      }))
    }));
    
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all permissions
const getPermissions = async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { moduleKey: 'asc' }
    });
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get permissions by module
const getPermissionsByModule = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    
    const permissions = await prisma.permission.findMany({
      where: {
        moduleKey: {
          startsWith: moduleKey
        }
      },
      orderBy: { action: 'asc' }
    });
    
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new role
const createRole = async (req, res) => {
  try {
    const { name, key, description, industryKey, permissionIds } = req.body;
    
    const industry = await prisma.industry.findUnique({
      where: { key: industryKey }
    });
    
    if (!industry) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    
    // Check if role key already exists
    const existingRole = await prisma.role.findUnique({
      where: { key }
    });
    
    if (existingRole) {
      return res.status(400).json({ error: 'Role key already exists' });
    }
    
    const role = await prisma.role.create({
      data: {
        name,
        key,
        description,
        industryId: industry.id
      }
    });
    
    // Assign permissions
    if (permissionIds && permissionIds.length > 0) {
      for (const permissionId of permissionIds) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId
          }
        });
      }
    }
    
    res.status(201).json({
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
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;
    
    const role = await prisma.role.update({
      where: { id },
      data: { name, description }
    });
    
    // Update permissions if provided
    if (permissionIds) {
      // Remove existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: id }
      });
      
      // Add new permissions
      for (const permissionId of permissionIds) {
        await prisma.rolePermission.create({
          data: {
            roleId: id,
            permissionId
          }
        });
      }
    }
    
    res.json({
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
    const { id } = req.params;
    
    // Check if role is assigned to any user
    const userCount = await prisma.userRoleAssignment.count({
      where: { roleId: id }
    });
    
    if (userCount > 0) {
      return res.status(400).json({ error: 'Cannot delete role assigned to users' });
    }
    
    // Delete role permissions first
    await prisma.rolePermission.deleteMany({
      where: { roleId: id }
    });
    
    // Delete role
    await prisma.role.delete({
      where: { id }
    });
    
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Assign role to user
const assignRoleToUser = async (req, res) => {
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
    
    const assignment = await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId_moduleId: {
          userId,
          roleId,
          moduleId: moduleId || null
        }
      },
      update: {},
      create: {
        userId,
        roleId,
        moduleId
      }
    });
    
    res.json({
      message: 'Role assigned successfully',
      assignment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove role from user
const removeRoleFromUser = async (req, res) => {
  try {
    const { userId, roleId } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    await prisma.userRoleAssignment.deleteMany({
      where: {
        userId,
        roleId,
        user: { orgCode }
      }
    });
    
    res.json({ message: 'Role removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user's roles
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
        role: true,
        module: true
      }
    });
    
    res.json(userRoles.map(ur => ({
      id: ur.id,
      role: ur.role,
      module: ur.module
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getRoles,
  getPermissions,
  getPermissionsByModule,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles
};

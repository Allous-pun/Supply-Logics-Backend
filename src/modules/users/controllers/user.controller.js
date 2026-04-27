const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { uploadImage } = require('../../../utils/cloudinary');
const prisma = new PrismaClient();

const generateLoginCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get all users in organization
const getUsers = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const users = await prisma.user.findMany({
      where: { orgCode },
      include: {
        userRoles: {
          include: {
            role: true
          }
        },
        branchStaff: {
          include: {
            branch: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedUsers = users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.userRoles.map(ur => ({
        id: ur.role.id,
        name: ur.role.name,
        key: ur.role.key
      })),
      branches: user.branchStaff.map(bs => ({
        id: bs.branch.id,
        name: bs.branch.name,
        role: bs.role
      }))
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    const user = await prisma.user.findFirst({
      where: {
        id,
        orgCode
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        },
        branchStaff: {
          include: {
            branch: true
          }
        },
        organization: {
          select: {
            name: true,
            orgCode: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.userRoles.map(ur => ({
        id: ur.role.id,
        name: ur.role.name,
        key: ur.role.key
      })),
      branches: user.branchStaff.map(bs => ({
        id: bs.branch.id,
        name: bs.branch.name,
        code: bs.branch.code,
        role: bs.role
      })),
      organization: user.organization
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new user (staff)
const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, roleId, branchIds } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Generate login code
    const loginCode = generateLoginCode();
    const hashedLoginCode = await bcrypt.hash(loginCode, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        orgCode,
        loginCode: hashedLoginCode,
        organizationId: organization.id,
        legacyRole: 'STAFF'
      }
    });
    
    // Assign role
    if (roleId) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId
        }
      });
    }
    
    // Assign to branches
    if (branchIds && branchIds.length > 0) {
      for (const branchId of branchIds) {
        await prisma.branchStaff.create({
          data: {
            branchId,
            userId: user.id,
            role: 'STAFF'
          }
        });
      }
    }
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone
      },
      loginCode
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, isActive, roleId, branchIds } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const user = await prisma.user.updateMany({
      where: {
        id,
        orgCode
      },
      data: {
        firstName,
        lastName,
        email,
        phone,
        isActive
      }
    });
    
    // Update role if provided
    if (roleId) {
      await prisma.userRoleAssignment.deleteMany({
        where: { userId: id }
      });
      await prisma.userRoleAssignment.create({
        data: {
          userId: id,
          roleId
        }
      });
    }
    
    // Update branch assignments
    if (branchIds) {
      await prisma.branchStaff.deleteMany({
        where: { userId: id }
      });
      for (const branchId of branchIds) {
        await prisma.branchStaff.create({
          data: {
            branchId,
            userId: id,
            role: 'STAFF'
          }
        });
      }
    }
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    // Delete role assignments
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: id }
    });
    
    // Delete branch assignments
    await prisma.branchStaff.deleteMany({
      where: { userId: id }
    });
    
    // Delete user
    await prisma.user.deleteMany({
      where: {
        id,
        orgCode
      }
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Regenerate login code for user
const regenerateLoginCode = async (req, res) => {
  try {
    const { id } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    const newLoginCode = generateLoginCode();
    const hashedNewCode = await bcrypt.hash(newLoginCode, 10);
    
    await prisma.user.updateMany({
      where: {
        id,
        orgCode
      },
      data: { loginCode: hashedNewCode }
    });
    
    res.json({
      message: 'Login code regenerated successfully',
      loginCode: newLoginCode
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Upload user avatar
const uploadAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Convert buffer to base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    const result = await uploadImage(base64Image, `organizations/${orgCode}/users/${id}/avatar`);
    
    // Store avatar URL in user profile (you may need to add avatar field to User model)
    // For now, just return the URL
    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  regenerateLoginCode,
  uploadAvatar
};

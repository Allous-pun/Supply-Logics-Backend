const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const generateLoginCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateToken = (user, roles, permissions) => {
  return jwt.sign(
    {
      userId: user.id,
      orgCode: user.orgCode,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: roles,
      permissions: permissions
    },
    process.env.JWT_SECRET || 'bizstack-secret-key-change-in-production',
    { expiresIn: '7d' }
  );
};

const registerOwner = async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    if (!orgCode) {
      return res.status(400).json({ error: 'Organization code (x-org-code header) is required' });
    }
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        industry: {
          include: {
            roles: {
              where: { key: 'HOSP_OWNER' }
            }
          }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const userCount = await prisma.user.count({
      where: { orgCode }
    });
    
    if (userCount > 0) {
      return res.status(403).json({ error: 'Organization already has an owner' });
    }
    
    const ownerRole = organization.industry.roles[0];
    
    if (!ownerRole) {
      return res.status(500).json({ error: 'OWNER role not found' });
    }
    
    const loginCode = generateLoginCode();
    const hashedLoginCode = await bcrypt.hash(loginCode, 10);
    
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        orgCode,
        loginCode: hashedLoginCode,
        organizationId: organization.id,
        legacyRole: 'ORG_ADMIN'
      }
    });
    
    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: ownerRole.id
      }
    });
    
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: ownerRole.id },
      include: { permission: true }
    });
    
    const permissions = rolePermissions.map(rp => ({
      moduleKey: rp.permission.moduleKey,
      action: rp.permission.action
    }));
    
    const token = generateToken(user, [ownerRole.key], permissions);
    
    res.status(201).json({
      message: 'Owner registered successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        orgCode: user.orgCode,
        role: ownerRole.name,
        roleKey: ownerRole.key
      },
      loginCode,
      token
    });
  } catch (error) {
    console.error('Register owner error:', error);
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { loginCode } = req.body;
    
    if (!loginCode) {
      return res.status(400).json({ error: 'Login code is required' });
    }
    
    // Find ALL users (search across all organizations)
    const allUsers = await prisma.user.findMany({
      include: {
        organization: true,
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    // Find users with matching login code
    const matchingUsers = [];
    for (const user of allUsers) {
      const isValid = await bcrypt.compare(loginCode, user.loginCode);
      if (isValid) {
        matchingUsers.push(user);
      }
    }
    
    if (matchingUsers.length === 0) {
      return res.status(401).json({ error: 'Invalid login code' });
    }
    
    // Handle multiple users with same login code
    let foundUser = matchingUsers[0];
    
    if (matchingUsers.length > 1) {
      // Additional logic for multiple matches:
      // 1. Check if any user has been active recently
      const sortedByLastLogin = [...matchingUsers].sort((a, b) => {
        if (!a.lastLoginAt) return 1;
        if (!b.lastLoginAt) return -1;
        return b.lastLoginAt.getTime() - a.lastLoginAt.getTime();
      });
      
      // 2. Prefer the most recently active user
      if (sortedByLastLogin[0]?.lastLoginAt) {
        foundUser = sortedByLastLogin[0];
      } else {
        // 3. If no recent activity, return error asking for additional info
        const orgNames = matchingUsers.map(u => u.organization?.name).filter(Boolean);
        return res.status(409).json({
          error: 'Multiple organizations found with this login code',
          message: 'Please select your organization',
          organizations: orgNames,
          userIds: matchingUsers.map(u => u.id)
        });
      }
    }
    
    if (!foundUser.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: foundUser.id },
      data: { lastLoginAt: new Date() }
    });
    
    const roles = foundUser.userRoles.map(ur => ur.role.key);
    const roleNames = foundUser.userRoles.map(ur => ur.role.name);
    const permissions = [];
    foundUser.userRoles.forEach(ur => {
      ur.role.permissions.forEach(rp => {
        permissions.push({
          moduleKey: rp.permission.moduleKey,
          action: rp.permission.action
        });
      });
    });
    
    const token = generateToken(foundUser, roles, permissions);
    
    res.json({
      message: 'Login successful',
      user: {
        id: foundUser.id,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        email: foundUser.email,
        orgCode: foundUser.orgCode,
        roles: roleNames,
        roleKeys: roles
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const orgCode = req.user.orgCode;
    
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        orgCode
      },
      include: {
        organization: {
          include: {
            industry: true
          }
        },
        userRoles: {
          include: {
            role: true
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
      orgCode: user.orgCode,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        industry: user.organization.industry.name
      },
      roles: user.userRoles.map(ur => ({
        name: ur.role.name,
        key: ur.role.key
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  registerOwner,
  login,
  getProfile
};
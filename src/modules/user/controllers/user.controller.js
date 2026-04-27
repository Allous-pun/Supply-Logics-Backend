const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Owner adds employee with specific role
const addEmployee = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, roleId } = req.body;
    const orgCode = req.headers['x-org-code'];
    const ownerId = req.user.userId;
    
    // Verify owner has OWNER role
    const ownerRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId: ownerId,
        role: {
          code: 'HOSP_OWNER'
        }
      }
    });
    
    if (ownerRoles.length === 0) {
      return res.status(403).json({ error: 'Only organization owner can add employees' });
    }
    
    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId }
    });
    
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Generate login code
    const loginCode = generateCode();
    const hashedLoginCode = await bcrypt.hash(loginCode, 10);
    
    // Create employee
    const employee = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        orgCode,
        loginCode: hashedLoginCode,
        organizationId: organization.id
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        orgCode: true,
        isActive: true,
        createdAt: true
      }
    });
    
    // Assign role to employee
    await prisma.userRoleAssignment.create({
      data: {
        userId: employee.id,
        roleId: role.id
      }
    });
    
    res.status(201).json({
      message: 'Employee added successfully',
      employee: {
        ...employee,
        loginCode,
        assignedRole: role.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all employees in organization (Owner only)
const getAllEmployees = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const ownerId = req.user.userId;
    
    // Verify owner has OWNER role
    const ownerRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId: ownerId,
        role: {
          code: 'HOSP_OWNER'
        }
      }
    });
    
    if (ownerRoles.length === 0) {
      return res.status(403).json({ error: 'Only organization owner can view employees' });
    }
    
    const employees = await prisma.user.findMany({
      where: {
        orgCode,
        id: { not: ownerId }
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedEmployees = employees.map(emp => ({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone,
      isActive: emp.isActive,
      lastLoginAt: emp.lastLoginAt,
      createdAt: emp.createdAt,
      roles: emp.userRoles.map(ur => ur.role)
    }));
    
    res.json(formattedEmployees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single employee by ID
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const employee = await prisma.user.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            name: true,
            orgCode: true
          }
        },
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      isActive: employee.isActive,
      lastLoginAt: employee.lastLoginAt,
      createdAt: employee.createdAt,
      organization: employee.organization,
      roles: employee.userRoles.map(ur => ur.role)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update employee details and role (Owner only)
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, isActive, roleId } = req.body;
    const ownerId = req.user.userId;
    
    // Verify owner
    const ownerRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId: ownerId,
        role: {
          code: 'HOSP_OWNER'
        }
      }
    });
    
    if (ownerRoles.length === 0) {
      return res.status(403).json({ error: 'Only organization owner can update employees' });
    }
    
    // Update employee basic info
    const employee = await prisma.user.update({
      where: { id },
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
    
    res.json({
      message: 'Employee updated successfully',
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        isActive: employee.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete employee (Owner only)
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.userId;
    
    // Verify owner
    const ownerRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId: ownerId,
        role: {
          code: 'HOSP_OWNER'
        }
      }
    });
    
    if (ownerRoles.length === 0) {
      return res.status(403).json({ error: 'Only organization owner can delete employees' });
    }
    
    // Delete role assignments first
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: id }
    });
    
    // Delete user
    await prisma.user.delete({ where: { id } });
    
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Regenerate login code for employee (Owner only)
const regenerateEmployeeCode = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.userId;
    
    // Verify owner
    const ownerRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId: ownerId,
        role: {
          code: 'HOSP_OWNER'
        }
      }
    });
    
    if (ownerRoles.length === 0) {
      return res.status(403).json({ error: 'Only organization owner can regenerate codes' });
    }
    
    const newLoginCode = generateCode();
    const hashedNewCode = await bcrypt.hash(newLoginCode, 10);
    
    await prisma.user.update({
      where: { id },
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

module.exports = {
  addEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  regenerateEmployeeCode
};

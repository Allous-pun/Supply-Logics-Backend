const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { geocodeAddress } = require('../../../utils/geocoding.js');

const generateOrgCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create organization (first step - no auth needed)
const createOrganization = async (req, res) => {
  try {
    const { 
      name, email, phone, industryKey, 
      address, city, region, country, postalCode 
    } = req.body;
    
    if (!name || !email || !industryKey) {
      return res.status(400).json({ error: 'Name, email, and industryKey are required' });
    }
    
    // Get industry
    const industry = await prisma.industry.findUnique({
      where: { key: industryKey }
    });
    
    if (!industry) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const orgCode = generateOrgCode();
    
    // Check if slug already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug }
    });
    
    if (existingOrg) {
      return res.status(400).json({ error: 'Organization name already taken' });
    }
    
    // Geocode address if provided
    let latitude = null;
    let longitude = null;
    let formattedAddress = address;
    
    if (address || city) {
      const geocodeResult = await geocodeAddress(address, city, region, country || 'Kenya');
      if (geocodeResult) {
        latitude = geocodeResult.latitude;
        longitude = geocodeResult.longitude;
        formattedAddress = geocodeResult.formattedAddress;
      }
    }
    
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        email,
        phone,
        orgCode,
        industryId: industry.id,
        address: formattedAddress,
        city,
        region,
        country: country || 'Kenya',
        postalCode,
        latitude,
        longitude
      },
      include: {
        industry: {
          select: {
            name: true,
            key: true,
            icon: true,
            color: true
          }
        }
      }
    });
    
    // Auto-enable core modules for this organization
    const coreModules = await prisma.module.findMany({
      where: {
        industryId: industry.id,
        isCore: true
      }
    });
    
    for (const module of coreModules) {
      await prisma.organizationModule.create({
        data: {
          organizationId: organization.id,
          moduleId: module.id,
          isEnabled: true
        }
      });
    }
    
    // Create default organization settings
    await prisma.organizationSettings.create({
      data: {
        organizationId: organization.id
      }
    });
    
    res.status(201).json({
      message: 'Organization created successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        orgCode: organization.orgCode,
        industry: organization.industry,
        address: organization.address,
        city: organization.city,
        region: organization.region,
        country: organization.country,
        latitude: organization.latitude,
        longitude: organization.longitude
      },
      enabledModules: coreModules.length
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all organizations (admin only)
const getOrganizations = async (req, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        industry: {
          select: {
            name: true,
            key: true,
            icon: true,
            color: true
          }
        },
        branches: true,
        _count: {
          select: { users: true, branches: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(organizations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get organization by ID
const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        industry: {
          select: {
            name: true,
            key: true,
            icon: true,
            color: true
          }
        },
        modules: {
          include: {
            module: true
          }
        },
        settings: true,
        branches: {
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
          }
        },
        _count: {
          select: { users: true, branches: true }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get organization by orgCode (from header)
const getMyOrganization = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    if (!orgCode) {
      return res.status(400).json({ error: 'Organization code required' });
    }
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        industry: {
          select: {
            name: true,
            key: true,
            icon: true,
            color: true
          }
        },
        modules: {
          include: {
            module: true
          }
        },
        settings: true,
        branches: {
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
        },
        _count: {
          select: { users: true, branches: true }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update organization
const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, email, phone, address, isActive,
      city, region, country, postalCode
    } = req.body;
    
    const updateData = { 
      email, 
      phone, 
      isActive,
      city,
      region,
      country,
      postalCode
    };
    
    if (name) {
      updateData.name = name;
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }
    
    // If address changed, geocode it automatically
    if (address || city) {
      const geocodeResult = await geocodeAddress(address, city, region, country || 'Kenya');
      if (geocodeResult) {
        updateData.latitude = geocodeResult.latitude;
        updateData.longitude = geocodeResult.longitude;
        updateData.address = geocodeResult.formattedAddress;
      } else {
        updateData.address = address;
      }
    }
    
    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
      include: {
        industry: {
          select: {
            name: true,
            key: true
          }
        }
      }
    });
    
    res.json({
      message: 'Organization updated successfully',
      organization
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete organization (soft delete)
const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete - just deactivate
    const organization = await prisma.organization.update({
      where: { id },
      data: { isActive: false }
    });
    
    res.json({
      message: 'Organization deactivated successfully',
      organization: {
        id: organization.id,
        name: organization.name,
        isActive: organization.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get enabled modules for organization
const getEnabledModules = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        modules: {
          include: {
            module: {
              include: {
                industry: {
                  select: {
                    name: true,
                    key: true
                  }
                }
              }
            }
          },
          where: { isEnabled: true }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const enabledModules = organization.modules.map(om => ({
      id: om.module.id,
      name: om.module.name,
      key: om.module.key,
      icon: om.module.icon,
      color: om.module.color,
      isCore: om.module.isCore
    }));
    
    res.json(enabledModules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle module for organization
const toggleModule = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const module = await prisma.module.findUnique({
      where: { key: moduleKey }
    });
    
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    const existing = await prisma.organizationModule.findUnique({
      where: {
        organizationId_moduleId: {
          organizationId: organization.id,
          moduleId: module.id
        }
      }
    });
    
    let result;
    if (existing) {
      result = await prisma.organizationModule.update({
        where: { id: existing.id },
        data: { isEnabled: !existing.isEnabled }
      });
    } else {
      result = await prisma.organizationModule.create({
        data: {
          organizationId: organization.id,
          moduleId: module.id,
          isEnabled: true
        }
      });
    }
    
    res.json({
      message: `Module ${result.isEnabled ? 'enabled' : 'disabled'} successfully`,
      isEnabled: result.isEnabled
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get organization location (for distance calculations)
const getOrganizationLocation = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        region: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update organization location (specifically for location)
const updateOrganizationLocation = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { address, city, region, country, postalCode } = req.body;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const updateData = {};
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (region !== undefined) updateData.region = region;
    if (country !== undefined) updateData.country = country;
    if (postalCode !== undefined) updateData.postalCode = postalCode;
    
    // Auto-geocode when location is updated
    if (address || city) {
      const geocodeResult = await geocodeAddress(address, city, region, country || 'Kenya');
      if (geocodeResult) {
        updateData.latitude = geocodeResult.latitude;
        updateData.longitude = geocodeResult.longitude;
        updateData.address = geocodeResult.formattedAddress;
      }
    }
    
    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        region: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true
      }
    });
    
    res.json({
      message: 'Organization location updated successfully',
      location: updated
    });
  } catch (error) {
    console.error('Update organization location error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
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
};
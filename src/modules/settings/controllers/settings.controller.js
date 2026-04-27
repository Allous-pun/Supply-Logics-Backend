const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get organization settings
const getSettings = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        settings: true
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // If settings don't exist, create default settings
    if (!organization.settings) {
      const settings = await prisma.organizationSettings.create({
        data: {
          organizationId: organization.id
        }
      });
      return res.json(settings);
    }
    
    res.json(organization.settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update organization settings
const updateSettings = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const {
      currency,
      currencySymbol,
      timezone,
      dateFormat
    } = req.body;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: {
        organizationId: organization.id
      },
      update: {
        currency,
        currencySymbol,
        timezone,
        dateFormat
      },
      create: {
        organizationId: organization.id,
        currency,
        currencySymbol,
        timezone,
        dateFormat
      }
    });
    
    res.json({
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update currency settings
const updateCurrency = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { currency, currencySymbol } = req.body;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: { currency, currencySymbol },
      create: {
        organizationId: organization.id,
        currency,
        currencySymbol
      }
    });
    
    res.json({
      message: 'Currency settings updated',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update regional settings
const updateRegional = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { timezone, dateFormat } = req.body;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: { timezone, dateFormat },
      create: {
        organizationId: organization.id,
        timezone,
        dateFormat
      }
    });
    
    res.json({
      message: 'Regional settings updated',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset settings to default
const resetSettings = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: {
        currency: 'KES',
        currencySymbol: 'KSh',
        timezone: 'Africa/Nairobi',
        dateFormat: 'DD/MM/YYYY'
      },
      create: {
        organizationId: organization.id,
        currency: 'KES',
        currencySymbol: 'KSh',
        timezone: 'Africa/Nairobi',
        dateFormat: 'DD/MM/YYYY'
      }
    });
    
    res.json({
      message: 'Settings reset to default',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  updateCurrency,
  updateRegional,
  resetSettings
};

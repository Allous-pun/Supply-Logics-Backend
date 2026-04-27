const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getSettings = async (req, res) => {
  try {
    const organization = req.organization;
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    if (!organization.settings) {
      const defaultSettings = await prisma.organizationSettings.create({
        data: {
          organizationId: organization.id
        }
      });
      organization.settings = defaultSettings;
    }
    
    res.json(organization.settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const organization = req.organization;
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settingsData = req.body;
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: settingsData,
      create: {
        organizationId: organization.id,
        ...settingsData
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

const updateRegionalSettings = async (req, res) => {
  try {
    const organization = req.organization;
    const {
      currency,
      currencySymbol,
      currencyPosition,
      decimalSeparator,
      thousandSeparator,
      decimalPlaces,
      timezone,
      dateFormat,
      timeFormat,
      weekStartDay
    } = req.body;
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: {
        currency,
        currencySymbol,
        currencyPosition,
        decimalSeparator,
        thousandSeparator,
        decimalPlaces,
        timezone,
        dateFormat,
        timeFormat,
        weekStartDay
      },
      create: {
        organizationId: organization.id,
        currency,
        currencySymbol,
        currencyPosition,
        decimalSeparator,
        thousandSeparator,
        decimalPlaces,
        timezone,
        dateFormat,
        timeFormat,
        weekStartDay
      }
    });
    
    res.json({
      message: 'Regional settings updated successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSecuritySettings = async (req, res) => {
  try {
    const organization = req.organization;
    const {
      minPasswordLength,
      requireUppercase,
      requireLowercase,
      requireNumbers,
      requireSpecialChars,
      passwordExpiryDays,
      sessionTimeoutMinutes,
      maxLoginAttempts,
      lockoutDurationMinutes,
      twoFactorRequired
    } = req.body;
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: {
        minPasswordLength,
        requireUppercase,
        requireLowercase,
        requireNumbers,
        requireSpecialChars,
        passwordExpiryDays,
        sessionTimeoutMinutes,
        maxLoginAttempts,
        lockoutDurationMinutes,
        twoFactorRequired
      },
      create: {
        organizationId: organization.id,
        minPasswordLength,
        requireUppercase,
        requireLowercase,
        requireNumbers,
        requireSpecialChars,
        passwordExpiryDays,
        sessionTimeoutMinutes,
        maxLoginAttempts,
        lockoutDurationMinutes,
        twoFactorRequired
      }
    });
    
    res.json({
      message: 'Security settings updated successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateInvoiceSettings = async (req, res) => {
  try {
    const organization = req.organization;
    const {
      invoicePrefix,
      invoiceNumberStart,
      taxRate,
      taxName
    } = req.body;
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: {
        invoicePrefix,
        invoiceNumberStart,
        taxRate,
        taxName
      },
      create: {
        organizationId: organization.id,
        invoicePrefix,
        invoiceNumberStart,
        taxRate,
        taxName
      }
    });
    
    res.json({
      message: 'Invoice settings updated successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateNotificationSettings = async (req, res) => {
  try {
    const organization = req.organization;
    const {
      enableEmailNotifications,
      enableSmsNotifications,
      emailFooter,
      smsSenderId
    } = req.body;
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: {
        enableEmailNotifications,
        enableSmsNotifications,
        emailFooter,
        smsSenderId
      },
      create: {
        organizationId: organization.id,
        enableEmailNotifications,
        enableSmsNotifications,
        emailFooter,
        smsSenderId
      }
    });
    
    res.json({
      message: 'Notification settings updated successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateThemeSettings = async (req, res) => {
  try {
    const organization = req.organization;
    const {
      primaryColor,
      secondaryColor,
      logoUrl,
      faviconUrl
    } = req.body;
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: {
        primaryColor,
        secondaryColor,
        logoUrl,
        faviconUrl
      },
      create: {
        organizationId: organization.id,
        primaryColor,
        secondaryColor,
        logoUrl,
        faviconUrl
      }
    });
    
    res.json({
      message: 'Theme settings updated successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateBusinessHours = async (req, res) => {
  try {
    const organization = req.organization;
    const { businessHours } = req.body;
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: { businessHours },
      create: {
        organizationId: organization.id,
        businessHours
      }
    });
    
    res.json({
      message: 'Business hours updated successfully',
      businessHours: settings.businessHours
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  updateRegionalSettings,
  updateSecuritySettings,
  updateInvoiceSettings,
  updateNotificationSettings,
  updateThemeSettings,
  updateBusinessHours
};

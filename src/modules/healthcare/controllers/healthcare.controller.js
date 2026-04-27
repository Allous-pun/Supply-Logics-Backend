const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== MEDICAL INVENTORY ====================

const createMedicalItem = async (req, res) => {
  try {
    const {
      name, sku, barcode, description, category, manufacturer, supplierId,
      currentStock, minimumStock, maximumStock, reorderPoint, costPrice, sellingPrice,
      batchNumber, expiryDate, requiresRefrigeration, isControlled, prescriptionRequired
    } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const item = await prisma.medicalInventory.create({
      data: {
        name,
        sku,
        barcode: barcode || null,
        description: description || null,
        category,
        manufacturer: manufacturer || null,
        supplierId,
        currentStock: currentStock || 0,
        minimumStock: minimumStock || 0,
        maximumStock: maximumStock || 0,
        reorderPoint: reorderPoint || 0,
        costPrice: costPrice || 0,
        sellingPrice: sellingPrice || 0,
        batchNumber: batchNumber || null,
        expiryDate: new Date(expiryDate),
        requiresRefrigeration: requiresRefrigeration || false,
        isControlled: isControlled || false,
        prescriptionRequired: prescriptionRequired || false,
        organizationId: organization.id
      },
      include: {
        supplier: true
      }
    });
    
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMedicalItems = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { category, requiresRefrigeration, lowStock, expiringSoon } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (category) whereClause.category = category;
    if (requiresRefrigeration === 'true') whereClause.requiresRefrigeration = true;
    if (lowStock === 'true') whereClause.currentStock = { lte: prisma.medicalInventory.fields.reorderPoint };
    
    const items = await prisma.medicalInventory.findMany({
      where: whereClause,
      include: {
        supplier: true,
        coldChainLogs: {
          orderBy: { recordedAt: 'desc' },
          take: 5
        }
      },
      orderBy: { name: 'asc' }
    });
    
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const itemsWithExpiry = items.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      currentStock: item.currentStock,
      minimumStock: item.minimumStock,
      reorderPoint: item.reorderPoint,
      expiryDate: item.expiryDate,
      requiresRefrigeration: item.requiresRefrigeration,
      prescriptionRequired: item.prescriptionRequired,
      expiresInDays: Math.ceil((item.expiryDate - today) / (1000 * 60 * 60 * 24)),
      isExpiringSoon: item.expiryDate <= thirtyDaysFromNow,
      supplier: item.supplier
    }));
    
    res.json(itemsWithExpiry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== COLD CHAIN TRACKING ====================

const recordColdChainLog = async (req, res) => {
  try {
    const { medicalItemId, temperature, humidity, location, status } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const log = await prisma.coldChainLog.create({
      data: {
        medicalItemId,
        temperature,
        humidity: humidity || null,
        location: location || 'storage',
        status: status || (temperature > 8 ? 'warning' : 'normal'),
        recordedBy: userId,
        organizationId: organization.id
      },
      include: {
        medicalItem: true
      }
    });
    
    if (temperature > 10 || temperature < 0) {
      await prisma.expiryAlert.create({
        data: {
          medicalItemId,
          batchNumber: log.medicalItem.batchNumber || 'unknown',
          expiryDate: log.medicalItem.expiryDate,
          daysUntilExpiry: Math.ceil((log.medicalItem.expiryDate - new Date()) / (1000 * 60 * 60 * 24)),
          severity: temperature > 12 || temperature < -2 ? 'critical' : 'high',
          organizationId: organization.id
        }
      });
    }
    
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getColdChainLogs = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { medicalItemId, startDate, endDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (medicalItemId) whereClause.medicalItemId = medicalItemId;
    if (startDate && endDate) {
      whereClause.recordedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const logs = await prisma.coldChainLog.findMany({
      where: whereClause,
      include: {
        medicalItem: true
      },
      orderBy: { recordedAt: 'desc' }
    });
    
    const avgTemperature = logs.length > 0 ? logs.reduce((sum, l) => sum + l.temperature, 0) / logs.length : 0;
    const warnings = logs.filter(l => l.status === 'warning').length;
    const critical = logs.filter(l => l.status === 'critical' || l.temperature > 10 || l.temperature < 0).length;
    
    res.json({
      summary: {
        totalLogs: logs.length,
        avgTemperature: avgTemperature.toFixed(1),
        warnings,
        critical,
        complianceRate: logs.length > 0 ? ((logs.length - warnings - critical) / logs.length * 100).toFixed(1) : 100
      },
      logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== EXPIRY ALERTS ====================

const checkExpiryAlerts = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const expiringItems = await prisma.medicalInventory.findMany({
      where: {
        organizationId: organization.id,
        expiryDate: { lte: thirtyDaysFromNow },
        isActive: true
      },
      include: {
        supplier: true
      }
    });
    
    const alerts = [];
    for (const item of expiringItems) {
      const daysUntilExpiry = Math.ceil((item.expiryDate - today) / (1000 * 60 * 60 * 24));
      let severity = 'low';
      if (daysUntilExpiry <= 7) severity = 'critical';
      else if (daysUntilExpiry <= 14) severity = 'high';
      else if (daysUntilExpiry <= 30) severity = 'medium';
      
      const existingAlert = await prisma.expiryAlert.findFirst({
        where: {
          medicalItemId: item.id,
          batchNumber: item.batchNumber || 'unknown',
          status: 'PENDING'
        }
      });
      
      if (!existingAlert) {
        const alert = await prisma.expiryAlert.create({
          data: {
            medicalItemId: item.id,
            batchNumber: item.batchNumber || 'unknown',
            expiryDate: item.expiryDate,
            daysUntilExpiry,
            severity,
            organizationId: organization.id
          }
        });
        alerts.push(alert);
      } else {
        alerts.push(existingAlert);
      }
    }
    
    res.json({
      summary: {
        totalExpiring: expiringItems.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length
      },
      alerts: alerts.map(a => {
        const item = expiringItems.find(i => i.id === a.medicalItemId);
        return {
          id: a.id,
          itemName: item?.name,
          batchNumber: a.batchNumber,
          expiryDate: a.expiryDate,
          daysUntilExpiry: a.daysUntilExpiry,
          severity: a.severity,
          status: a.status
        };
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resolveExpiryAlert = async (req, res) => {
  try {
    const { id } = req.params;
    
    const alert = await prisma.expiryAlert.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date()
      }
    });
    
    res.json({ message: 'Alert resolved', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== EMERGENCY REORDERS ====================

const createEmergencyReorder = async (req, res) => {
  try {
    const { medicalItemId, quantity, urgency, reason } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const item = await prisma.medicalInventory.findUnique({
      where: { id: medicalItemId },
      include: { supplier: true }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Medical item not found' });
    }
    
    const count = await prisma.emergencyReorder.count();
    const requestNumber = `EMR-${String(count + 1).padStart(6, '0')}`;
    
    const emergencyReorder = await prisma.emergencyReorder.create({
      data: {
        medicalItemId,
        requestNumber,
        quantity,
        urgency: urgency || 'standard',
        reason,
        organizationId: organization.id
      }
    });
    
    if (urgency === 'emergency') {
      const poCount = await prisma.purchaseOrder.count();
      const poNumber = `PO-EMR-${String(poCount + 1).padStart(6, '0')}`;
      
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: item.supplierId,
          expectedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          items: [{ itemId: medicalItemId, quantity, unitPrice: item.costPrice }],
          subtotal: quantity * item.costPrice,
          total: quantity * item.costPrice,
          notes: `EMERGENCY ORDER: ${reason}`,
          organizationId: organization.id
        }
      });
      
      await prisma.emergencyReorder.update({
        where: { id: emergencyReorder.id },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
          purchaseOrderId: purchaseOrder.id
        }
      });
      
      return res.json({
        message: 'Emergency order created and purchase order generated',
        emergencyReorder,
        purchaseOrder
      });
    }
    
    res.status(201).json(emergencyReorder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getEmergencyReorders = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status, urgency } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    if (urgency) whereClause.urgency = urgency;
    
    const reorders = await prisma.emergencyReorder.findMany({
      where: whereClause,
      include: {
        medicalItem: {
          include: {
            supplier: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(reorders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const approveEmergencyReorder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const emergencyReorder = await prisma.emergencyReorder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date()
      }
    });
    
    res.json({ message: 'Emergency order approved', emergencyReorder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== HEALTHCARE DASHBOARD ====================

const getHealthcareDashboard = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const totalItems = await prisma.medicalInventory.count({
      where: { organizationId: organization.id }
    });
    
    const lowStockItems = await prisma.medicalInventory.count({
      where: {
        organizationId: organization.id,
        currentStock: { lte: prisma.medicalInventory.fields.reorderPoint }
      }
    });
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringItems = await prisma.medicalInventory.count({
      where: {
        organizationId: organization.id,
        expiryDate: { lte: thirtyDaysFromNow }
      }
    });
    
    const coldChainViolations = await prisma.coldChainLog.count({
      where: {
        organizationId: organization.id,
        status: { in: ['warning', 'critical'] },
        recordedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });
    
    const pendingEmergencyOrders = await prisma.emergencyReorder.count({
      where: {
        organizationId: organization.id,
        status: 'PENDING'
      }
    });
    
    let healthScore = 100;
    if (totalItems > 0) {
      healthScore -= (lowStockItems / totalItems) * 30;
      healthScore -= (expiringItems / totalItems) * 20;
      healthScore -= Math.min(30, coldChainViolations * 5);
      healthScore = Math.max(0, Math.min(100, Math.floor(healthScore)));
    } else {
      healthScore = 0;
    }
    
    res.json({
      metrics: {
        totalItems,
        lowStockItems,
        expiringItems,
        coldChainViolations,
        pendingEmergencyOrders,
        healthScore
      },
      alerts: {
        criticalExpiry: expiringItems > 5,
        coldChainBreach: coldChainViolations > 0,
        emergencyOrders: pendingEmergencyOrders > 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createMedicalItem,
  getMedicalItems,
  recordColdChainLog,
  getColdChainLogs,
  checkExpiryAlerts,
  resolveExpiryAlert,
  createEmergencyReorder,
  getEmergencyReorders,
  approveEmergencyReorder,
  getHealthcareDashboard
};

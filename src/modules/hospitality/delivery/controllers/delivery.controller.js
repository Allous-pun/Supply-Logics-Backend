const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate delivery number
const generateDeliveryNumber = async (prefix = 'DEL') => {
  const count = await prisma.supplierDelivery.count();
  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
};

const generateBranchDeliveryNumber = async (prefix = 'BRN-DEL') => {
  const count = await prisma.interBranchDelivery.count();
  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
};

// ==================== SUPPLIER DELIVERIES ====================

const createSupplierDelivery = async (req, res) => {
  try {
    const { poId, supplierId, expectedDate, trackingNumber, carrier, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const deliveryNumber = await generateDeliveryNumber('SUP-DEL');
    
    const delivery = await prisma.supplierDelivery.create({
      data: {
        deliveryNumber,
        poId,
        supplierId,
        expectedDate: new Date(expectedDate),
        trackingNumber,
        carrier,
        notes,
        organizationId: organization.id
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: true
          }
        },
        supplier: true
      }
    });
    
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'SHIPPED' }
    });
    
    const today = new Date();
    const expected = new Date(expectedDate);
    const daysDiff = Math.ceil((expected - today) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) {
      await prisma.deliveryAlert.create({
        data: {
          supplierDeliveryId: delivery.id,
          deliveryType: 'supplier',
          alertType: daysDiff === 0 ? 'EXPECTED_TODAY' : 'EXPECTED_TOMORROW',
          message: `Delivery ${deliveryNumber} expected ${daysDiff === 0 ? 'today' : 'tomorrow'}`,
          organizationId: organization.id
        }
      });
    }
    
    await prisma.deliveryCalendar.create({
      data: {
        deliveryId: delivery.id,
        deliveryType: 'supplier',
        scheduledDate: new Date(expectedDate),
        status: 'SCHEDULED',
        organizationId: organization.id
      }
    });
    
    res.status(201).json(delivery);
  } catch (error) {
    console.error('Create supplier delivery error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getSupplierDeliveries = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status, supplierId, fromDate, toDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    if (supplierId) whereClause.supplierId = supplierId;
    if (fromDate) whereClause.expectedDate = { gte: new Date(fromDate) };
    if (toDate) whereClause.expectedDate = { ...whereClause.expectedDate, lte: new Date(toDate) };
    
    const deliveries = await prisma.supplierDelivery.findMany({
      where: whereClause,
      include: {
        purchaseOrder: {
          include: {
            supplier: true
          }
        },
        supplier: true,
        alerts: true
      },
      orderBy: { expectedDate: 'asc' }
    });
    
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actualDate, delayedReason } = req.body;
    
    const updateData = { status };
    if (actualDate) updateData.actualDate = new Date(actualDate);
    if (delayedReason) updateData.delayedReason = delayedReason;
    
    if (status === 'DELAYED') {
      const delivery = await prisma.supplierDelivery.findUnique({ where: { id } });
      await prisma.deliveryAlert.create({
        data: {
          supplierDeliveryId: id,
          deliveryType: 'supplier',
          alertType: 'DELAYED',
          message: `Delivery has been delayed. Reason: ${delayedReason || 'Unknown'}`,
          organizationId: delivery.organizationId
        }
      });
    }
    
    if (status === 'DELIVERED') {
      updateData.actualDate = actualDate ? new Date(actualDate) : new Date();
      
      await prisma.deliveryCalendar.updateMany({
        where: { deliveryId: id, deliveryType: 'supplier' },
        data: { status: 'DELIVERED' }
      });
      
      const delivery = await prisma.supplierDelivery.findUnique({
        where: { id },
        include: { purchaseOrder: true }
      });
      
      if (delivery) {
        await prisma.purchaseOrder.update({
          where: { id: delivery.poId },
          data: { status: 'DELIVERED', deliveryDate: new Date() }
        });
      }
    }
    
    const delivery = await prisma.supplierDelivery.update({
      where: { id },
      data: updateData
    });
    
    res.json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== INTER-BRANCH DELIVERIES ====================

const createInterBranchDelivery = async (req, res) => {
  try {
    const { fromBranchId, toBranchId, expectedDate, items, carrier, driverName, driverPhone, vehicleNumber, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const deliveryNumber = await generateBranchDeliveryNumber();
    
    const delivery = await prisma.interBranchDelivery.create({
      data: {
        deliveryNumber,
        fromBranchId,
        toBranchId,
        expectedDate: new Date(expectedDate),
        items,
        carrier,
        driverName,
        driverPhone,
        vehicleNumber,
        notes,
        organizationId: organization.id
      },
      include: {
        fromBranch: true,
        toBranch: true
      }
    });
    
    await prisma.deliveryCalendar.create({
      data: {
        deliveryId: delivery.id,
        deliveryType: 'branch',
        scheduledDate: new Date(expectedDate),
        status: 'SCHEDULED',
        organizationId: organization.id
      }
    });
    
    res.status(201).json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInterBranchDeliveries = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status, branchId, direction } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    
    if (branchId && direction === 'from') {
      whereClause.fromBranchId = branchId;
    } else if (branchId && direction === 'to') {
      whereClause.toBranchId = branchId;
    }
    
    const deliveries = await prisma.interBranchDelivery.findMany({
      where: whereClause,
      include: {
        fromBranch: true,
        toBranch: true,
        alerts: true
      },
      orderBy: { expectedDate: 'asc' }
    });
    
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateInterBranchDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actualDate } = req.body;
    
    const updateData = { status };
    if (actualDate) updateData.actualDate = new Date(actualDate);
    
    if (status === 'DELAYED') {
      const delivery = await prisma.interBranchDelivery.findUnique({ where: { id } });
      await prisma.deliveryAlert.create({
        data: {
          branchDeliveryId: id,
          deliveryType: 'branch',
          alertType: 'DELAYED',
          message: `Branch delivery has been delayed.`,
          organizationId: delivery.organizationId
        }
      });
    }
    
    if (status === 'DELIVERED') {
      updateData.actualDate = actualDate ? new Date(actualDate) : new Date();
      
      await prisma.deliveryCalendar.updateMany({
        where: { deliveryId: id, deliveryType: 'branch' },
        data: { status: 'DELIVERED' }
      });
    }
    
    const delivery = await prisma.interBranchDelivery.update({
      where: { id },
      data: updateData
    });
    
    res.json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DELIVERY CALENDAR ====================

const getDeliveryCalendar = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { startDate, endDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (startDate) whereClause.scheduledDate = { gte: new Date(startDate) };
    if (endDate) whereClause.scheduledDate = { ...whereClause.scheduledDate, lte: new Date(endDate) };
    
    const calendar = await prisma.deliveryCalendar.findMany({
      where: whereClause,
      orderBy: { scheduledDate: 'asc' }
    });
    
    const enrichedCalendar = await Promise.all(calendar.map(async (entry) => {
      let details = null;
      if (entry.deliveryType === 'supplier') {
        details = await prisma.supplierDelivery.findUnique({
          where: { id: entry.deliveryId },
          include: {
            supplier: true,
            purchaseOrder: true
          }
        });
      } else {
        details = await prisma.interBranchDelivery.findUnique({
          where: { id: entry.deliveryId },
          include: {
            fromBranch: true,
            toBranch: true
          }
        });
      }
      return { ...entry, details };
    }));
    
    res.json(enrichedCalendar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DELIVERY ALERTS ====================

const getDeliveryAlerts = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { resolved } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const alerts = await prisma.deliveryAlert.findMany({
      where: {
        organizationId: organization.id,
        isResolved: resolved === 'true' ? true : false
      },
      include: {
        supplierDelivery: {
          include: {
            supplier: true,
            purchaseOrder: true
          }
        },
        branchDelivery: {
          include: {
            fromBranch: true,
            toBranch: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    
    const alert = await prisma.deliveryAlert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date()
      }
    });
    
    res.json({ message: 'Alert resolved', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ETA PREDICTION ====================

const predictETA = async (req, res) => {
  try {
    const { supplierId, distanceKm } = req.body;
    
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        orderHistory: {
          where: { deliveryDate: { not: null } },
          orderBy: { orderDate: 'desc' },
          take: 10
        }
      }
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    let avgLeadTime = supplier.leadTime || 5;
    if (supplier.orderHistory.length > 0) {
      const leadTimes = supplier.orderHistory.map(o => {
        if (o.deliveryDate && o.orderDate) {
          const diff = o.deliveryDate.getTime() - o.orderDate.getTime();
          return diff / (1000 * 60 * 60 * 24);
        }
        return 0;
      }).filter(lt => lt > 0);
      
      if (leadTimes.length > 0) {
        avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
      }
    }
    
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(avgLeadTime));
    
    const confidence = supplier.orderHistory.length > 0 ? 
      Math.min(95, 60 + (supplier.orderHistory.length * 3.5)) : 50;
    
    res.json({
      supplier: supplier.name,
      avgLeadTime: avgLeadTime.toFixed(1),
      estimatedDate: estimatedDate,
      confidence: `${Math.floor(confidence)}%`,
      basedOnOrders: supplier.orderHistory.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createSupplierDelivery,
  getSupplierDeliveries,
  updateDeliveryStatus,
  createInterBranchDelivery,
  getInterBranchDeliveries,
  updateInterBranchDeliveryStatus,
  getDeliveryCalendar,
  getDeliveryAlerts,
  resolveAlert,
  predictETA
};

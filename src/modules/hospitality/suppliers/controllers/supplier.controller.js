const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generateSupplierCode = async (organizationId) => {
  const count = await prisma.supplier.count({
    where: { organizationId: organizationId }
  });
  
  const lastSupplier = await prisma.supplier.findFirst({
    where: { organizationId: organizationId },
    orderBy: { code: 'desc' },
    select: { code: true }
  });
  
  if (!lastSupplier) {
    return 'SUP-0001';
  }
  
  const match = lastSupplier.code.match(/SUP-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1]) + 1;
    return `SUP-${String(nextNum).padStart(4, '0')}`;
  }
  
  return `SUP-${String(count + 1).padStart(4, '0')}`;
};

// ==================== BASE SUPPLIER CRUD ====================

const createSupplier = async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address, taxId, paymentTerms, leadTime, rating } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let lastSupplier = await prisma.supplier.findFirst({
      where: { organizationId: organization.id },
      orderBy: { code: 'desc' },
      select: { code: true }
    });
    
    let code;
    if (!lastSupplier) {
      code = 'SUP-0001';
    } else {
      const match = lastSupplier.code.match(/SUP-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        code = `SUP-${String(nextNum).padStart(4, '0')}`;
      } else {
        code = 'SUP-0001';
      }
    }
    
    const supplier = await prisma.supplier.create({
      data: {
        name,
        code,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        taxId: taxId || null,
        paymentTerms: paymentTerms || null,
        leadTime: leadTime ? parseInt(leadTime) : null,
        rating: rating || 0,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getSuppliers = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { isActive, minRating } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';
    if (minRating) whereClause.rating = { gte: parseFloat(minRating) };
    
    const suppliers = await prisma.supplier.findMany({
      where: whereClause,
      include: {
        items: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        performance: {
          orderBy: { periodStart: 'desc' },
          take: 1
        }
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        items: true,
        priceHistory: {
          include: {
            item: true
          },
          orderBy: { effectiveDate: 'desc' },
          take: 20
        },
        performance: {
          orderBy: { periodStart: 'desc' }
        },
        orderHistory: {
          include: {
            purchaseOrder: true
          },
          orderBy: { orderDate: 'desc' },
          take: 20
        }
      }
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactPerson, email, phone, address, taxId, paymentTerms, leadTime, rating, isActive } = req.body;
    
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        contactPerson,
        email,
        phone,
        address,
        taxId,
        paymentTerms,
        leadTime: leadTime ? parseInt(leadTime) : null,
        rating,
        isActive
      }
    });
    
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    
    const itemCount = await prisma.inventoryItem.count({
      where: { supplierId: id }
    });
    
    if (itemCount > 0) {
      return res.status(400).json({ error: 'Cannot delete supplier with linked items' });
    }
    
    await prisma.supplier.delete({ where: { id } });
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== PRICE HISTORY ====================

const recordPriceChange = async (req, res) => {
  try {
    const { supplierId, itemId, previousPrice, newPrice, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const priceHistory = await prisma.supplierPriceHistory.create({
      data: {
        supplierId,
        itemId,
        previousPrice,
        newPrice,
        notes,
        createdBy: userId,
        organizationId: organization.id
      }
    });
    
    if (newPrice) {
      await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { costPrice: newPrice }
      });
    }
    
    res.status(201).json(priceHistory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPriceHistory = async (req, res) => {
  try {
    const { supplierId, itemId } = req.query;
    
    let whereClause = {};
    if (supplierId) whereClause.supplierId = supplierId;
    if (itemId) whereClause.itemId = itemId;
    
    const history = await prisma.supplierPriceHistory.findMany({
      where: whereClause,
      include: {
        supplier: true,
        item: true
      },
      orderBy: { effectiveDate: 'desc' }
    });
    
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== PERFORMANCE TRACKING ====================

const calculateSupplierPerformance = async (req, res) => {
  try {
    const { supplierId, periodStart, periodEnd, qualityRating } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        supplierId,
        organizationId: organization.id,
        orderDate: {
          gte: new Date(periodStart),
          lte: new Date(periodEnd)
        }
      }
    });
    
    const totalDeliveries = orders.length;
    const onTimeDeliveries = orders.filter(o => {
      if (!o.deliveryDate) return false;
      return o.deliveryDate <= o.expectedDate;
    }).length;
    
    const onTimeRate = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0;
    
    const leadTimes = orders.filter(o => o.deliveryDate).map(o => {
      const diff = o.deliveryDate.getTime() - o.orderDate.getTime();
      return diff / (1000 * 60 * 60 * 24);
    });
    const avgLeadTime = leadTimes.length > 0 
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length 
      : 0;
    
    const performance = await prisma.supplierPerformance.upsert({
      where: {
        supplierId_periodStart: {
          supplierId,
          periodStart: new Date(periodStart)
        }
      },
      update: {
        onTimeDeliveries,
        totalDeliveries,
        onTimeRate,
        avgLeadTime,
        qualityRating: qualityRating || 0,
        periodEnd: new Date(periodEnd),
        organizationId: organization.id
      },
      create: {
        supplierId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        onTimeDeliveries,
        totalDeliveries,
        onTimeRate,
        avgLeadTime,
        qualityRating: qualityRating || 0,
        organizationId: organization.id
      }
    });
    
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSupplierPerformance = async (req, res) => {
  try {
    const { supplierId } = req.params;
    
    const performances = await prisma.supplierPerformance.findMany({
      where: { supplierId },
      orderBy: { periodStart: 'desc' }
    });
    
    res.json(performances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== SUPPLIER COMPARISON ====================

const compareSuppliers = async (req, res) => {
  try {
    const { itemId } = req.query;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let suppliers;
    
    if (itemId) {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
        include: { category: true }
      });
      
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      suppliers = await prisma.supplier.findMany({
        where: {
          organizationId: organization.id,
          isActive: true
        },
        include: {
          items: {
            where: {
              OR: [
                { id: itemId },
                { categoryId: item.categoryId }
              ]
            }
          },
          performance: {
            orderBy: { periodStart: 'desc' },
            take: 1
          }
        }
      });
      
      const comparison = suppliers.map(supplier => ({
        id: supplier.id,
        name: supplier.name,
        rating: supplier.rating,
        leadTime: supplier.leadTime,
        paymentTerms: supplier.paymentTerms,
        onTimeRate: supplier.performance[0]?.onTimeRate || 0,
        suppliesItem: supplier.items.some(i => i.id === itemId),
        lastPerformance: supplier.performance[0]
      }));
      
      comparison.sort((a, b) => {
        if (a.suppliesItem !== b.suppliesItem) return a.suppliesItem ? -1 : 1;
        return (b.rating + b.onTimeRate) - (a.rating + a.onTimeRate);
      });
      
      return res.json(comparison);
    } else {
      // Compare all suppliers without item filter
      suppliers = await prisma.supplier.findMany({
        where: {
          organizationId: organization.id,
          isActive: true
        },
        include: {
          performance: {
            orderBy: { periodStart: 'desc' },
            take: 1
          }
        }
      });
      
      const comparison = suppliers.map(supplier => ({
        id: supplier.id,
        name: supplier.name,
        rating: supplier.rating,
        leadTime: supplier.leadTime,
        paymentTerms: supplier.paymentTerms,
        onTimeRate: supplier.performance[0]?.onTimeRate || 0,
        suppliesItem: true,
        lastPerformance: supplier.performance[0]
      }));
      
      comparison.sort((a, b) => (b.rating + b.onTimeRate) - (a.rating + a.onTimeRate));
      
      return res.json(comparison);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSupplierScorecard = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organization: { orgCode }
      },
      include: {
        performance: {
          orderBy: { periodStart: 'desc' },
          take: 3
        },
        orderHistory: {
          include: {
            purchaseOrder: true
          },
          orderBy: { orderDate: 'desc' },
          take: 10
        },
        priceHistory: {
          include: {
            item: true
          },
          take: 5,
          orderBy: { effectiveDate: 'desc' }
        },
        purchaseOrders: {
          where: {
            status: 'DELIVERED'
          },
          orderBy: { orderDate: 'desc' },
          take: 20
        }
      }
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    const recentPerformance = supplier.performance[0];
    const totalSpent = supplier.orderHistory.reduce((sum, order) => sum + order.totalAmount, 0);
    const lateOrders = supplier.orderHistory.filter(o => o.lateDays > 0).length;
    const onTimeRate = supplier.orderHistory.length > 0 
      ? ((supplier.orderHistory.length - lateOrders) / supplier.orderHistory.length) * 100 
      : 0;
    
    const scorecard = {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        rating: supplier.rating,
        leadTime: supplier.leadTime
      },
      metrics: {
        totalOrders: supplier.orderHistory.length,
        totalSpent,
        onTimeRate,
        lateOrders,
        avgLeadTime: recentPerformance?.avgLeadTime || supplier.leadTime || 0,
        qualityRating: recentPerformance?.qualityRating || 0
      },
      recentPerformance: recentPerformance,
      recentOrders: supplier.orderHistory.map(order => ({
        poNumber: order.purchaseOrder?.poNumber,
        orderDate: order.orderDate,
        deliveryDate: order.deliveryDate,
        totalAmount: order.totalAmount,
        status: order.status,
        lateDays: order.lateDays
      })),
      priceChanges: supplier.priceHistory
    };
    
    res.json(scorecard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  recordPriceChange,
  getPriceHistory,
  calculateSupplierPerformance,
  getSupplierPerformance,
  compareSuppliers,
  getSupplierScorecard
};
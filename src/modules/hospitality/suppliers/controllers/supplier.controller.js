const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { geocodeAddress } = require('../../../../utils/geocoding.js');

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
    const { 
      name, contactPerson, email, phone, address, 
      taxId, paymentTerms, leadTime, rating,
      city, region, country, postalCode
    } = req.body;
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
    
    const supplier = await prisma.supplier.create({
      data: {
        name,
        code,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: formattedAddress,
        taxId: taxId || null,
        paymentTerms: paymentTerms || null,
        leadTime: leadTime ? parseInt(leadTime) : null,
        rating: rating || 0,
        city: city || null,
        region: region || null,
        country: country || 'Kenya',
        postalCode: postalCode || null,
        latitude,
        longitude,
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
        },
        localSupplierScores: true
      },
      orderBy: { name: 'asc' }
    });
    
    // Format the response to include local score in a cleaner way
    const formattedSuppliers = suppliers.map(supplier => ({
      ...supplier,
      localSupplierScore: supplier.localSupplierScores?.[0] || null
    }));
    
    res.json(formattedSuppliers);
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
        },
        localSupplierScores: true
      }
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Format the response
    const formattedSupplier = {
      ...supplier,
      localSupplierScore: supplier.localSupplierScores?.[0] || null
    };
    
    res.json(formattedSupplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, contactPerson, email, phone, address, 
      taxId, paymentTerms, leadTime, rating, isActive,
      city, region, country, postalCode
    } = req.body;
    
    const updateData = {
      name,
      contactPerson,
      email,
      phone,
      taxId,
      paymentTerms,
      leadTime: leadTime ? parseInt(leadTime) : null,
      rating,
      isActive,
      city,
      region,
      country,
      postalCode
    };
    
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
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
    
    const supplier = await prisma.supplier.update({
      where: { id },
      data: updateData
    });
    
    res.json(supplier);
  } catch (error) {
    console.error('Update supplier error:', error);
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
          },
          localSupplierScores: true
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
        lastPerformance: supplier.performance[0],
        localSupplierScore: supplier.localSupplierScores?.[0] || null,
        city: supplier.city,
        region: supplier.region,
        latitude: supplier.latitude,
        longitude: supplier.longitude
      }));
      
      comparison.sort((a, b) => {
        if (a.suppliesItem !== b.suppliesItem) return a.suppliesItem ? -1 : 1;
        return (b.rating + b.onTimeRate) - (a.rating + a.onTimeRate);
      });
      
      return res.json(comparison);
    } else {
      suppliers = await prisma.supplier.findMany({
        where: {
          organizationId: organization.id,
          isActive: true
        },
        include: {
          performance: {
            orderBy: { periodStart: 'desc' },
            take: 1
          },
          localSupplierScores: true
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
        lastPerformance: supplier.performance[0],
        localSupplierScore: supplier.localSupplierScores?.[0] || null,
        city: supplier.city,
        region: supplier.region,
        latitude: supplier.latitude,
        longitude: supplier.longitude
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
        },
        localSupplierScores: true
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
        leadTime: supplier.leadTime,
        city: supplier.city,
        region: supplier.region,
        latitude: supplier.latitude,
        longitude: supplier.longitude
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
      priceChanges: supplier.priceHistory,
      localSupplierScore: supplier.localSupplierScores?.[0] || null
    };
    
    res.json(scorecard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get supplier location only
const getSupplierLocation = async (req, res) => {
  try {
    const { supplierId } = req.params;
    
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
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
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update supplier location only (with auto-geocoding)
const updateSupplierLocation = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { address, city, region, country, postalCode } = req.body;
    
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
    
    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
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
      message: 'Supplier location updated successfully with geocoding',
      location: supplier
    });
  } catch (error) {
    console.error('Update supplier location error:', error);
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
  getSupplierScorecard,
  getSupplierLocation,
  updateSupplierLocation
};
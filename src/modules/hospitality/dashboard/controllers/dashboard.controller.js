const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== MAIN DASHBOARD ====================

const getDashboard = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    // Get inventory metrics
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { organizationId: organization.id },
      include: {
        branchStock: true,
        lowStockAlerts: {
          where: { status: 'PENDING' }
        }
      }
    });
    
    const totalStockValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0);
    const lowStockCount = inventoryItems.filter(item => item.currentStock <= item.reorderPoint).length;
    const outOfStockCount = inventoryItems.filter(item => item.currentStock === 0).length;
    
    // Get procurement metrics
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: organization.id,
        orderDate: { gte: startOfMonth }
      }
    });
    
    const monthlySpend = purchaseOrders.reduce((sum, po) => sum + po.total, 0);
    const pendingOrders = await prisma.purchaseOrder.count({
      where: {
        organizationId: organization.id,
        status: { in: ['SUBMITTED', 'APPROVED', 'SHIPPED'] }
      }
    });
    
    // Get delivery metrics
    const deliveries = await prisma.supplierDelivery.findMany({
      where: {
        organizationId: organization.id,
        expectedDate: { gte: startOfWeek }
      }
    });
    
    const pendingDeliveries = deliveries.filter(d => d.status !== 'DELIVERED').length;
    const delayedDeliveries = deliveries.filter(d => 
      d.status === 'DELAYED' || (d.expectedDate < new Date() && d.status !== 'DELIVERED')
    ).length;
    
    // Get sustainability metrics
    const co2Emissions = await prisma.cO2Emission.findMany({
      where: {
        organizationId: organization.id,
        createdAt: { gte: startOfMonth }
      }
    });
    
    const totalCO2 = co2Emissions.reduce((sum, e) => sum + e.co2Emitted, 0);
    
    // Get recent activities
    const recentOrders = await prisma.purchaseOrder.findMany({
      where: { organizationId: organization.id },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    const recentMovements = await prisma.stockMovement.findMany({
      where: { organizationId: organization.id },
      include: { item: true, branch: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    const recentAlerts = await prisma.lowStockAlert.findMany({
      where: { organizationId: organization.id, status: 'PENDING' },
      include: { item: true, branch: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    res.json({
      summary: {
        totalStockValue: totalStockValue.toFixed(2),
        monthlySpend: monthlySpend.toFixed(2),
        lowStockCount,
        outOfStockCount,
        pendingOrders,
        pendingDeliveries,
        delayedDeliveries,
        totalCO2: totalCO2.toFixed(2)
      },
      alerts: {
        lowStock: recentAlerts,
        totalAlerts: recentAlerts.length
      },
      recentActivity: {
        orders: recentOrders.map(o => ({
          id: o.id,
          poNumber: o.poNumber,
          supplier: o.supplier.name,
          total: o.total,
          status: o.status,
          createdAt: o.createdAt
        })),
        stockMovements: recentMovements.map(m => ({
          id: m.id,
          item: m.item.name,
          quantity: m.quantity,
          type: m.type,
          reference: m.reference,
          createdAt: m.createdAt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== SPEND ANALYTICS ====================

const getSpendAnalytics = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { period = 'month', year = new Date().getFullYear() } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let startDate, endDate;
    if (period === 'month') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    } else if (period === 'quarter') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    }
    
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: organization.id,
        orderDate: { gte: startDate, lte: endDate }
      },
      include: {
        supplier: true
      }
    });
    
    // Monthly spend breakdown
    const monthlySpend = Array(12).fill(0);
    purchaseOrders.forEach(po => {
      const month = new Date(po.orderDate).getMonth();
      monthlySpend[month] += po.total;
    });
    
    // Spend by supplier
    const supplierSpend = {};
    purchaseOrders.forEach(po => {
      if (!supplierSpend[po.supplier.name]) {
        supplierSpend[po.supplier.name] = 0;
      }
      supplierSpend[po.supplier.name] += po.total;
    });
    
    const topSuppliers = Object.entries(supplierSpend)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    
    // Spend by category
    const ordersWithItems = await Promise.all(purchaseOrders.map(async (po) => {
      const items = po.items;
      let categorySpend = {};
      for (const item of items) {
        const inventoryItem = await prisma.inventoryItem.findUnique({
          where: { id: item.itemId },
          include: { category: true }
        });
        const category = inventoryItem?.category?.name || 'Uncategorized';
        categorySpend[category] = (categorySpend[category] || 0) + (item.quantity * item.unitPrice);
      }
      return categorySpend;
    }));
    
    const categorySpend = {};
    ordersWithItems.forEach(catSpend => {
      Object.entries(catSpend).forEach(([cat, amount]) => {
        categorySpend[cat] = (categorySpend[cat] || 0) + amount;
      });
    });
    
    const topCategories = Object.entries(categorySpend)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    
    res.json({
      period,
      year,
      totalSpend: purchaseOrders.reduce((sum, po) => sum + po.total, 0),
      monthlySpend,
      topSuppliers,
      topCategories,
      orderCount: purchaseOrders.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== INVENTORY ANALYTICS ====================

const getInventoryAnalytics = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { organizationId: organization.id },
      include: {
        category: true,
        movements: {
          where: {
            type: 'ISSUE',
            createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
          }
        }
      }
    });
    
    // Calculate turnover rate
    const totalValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0);
    const totalMovements = inventoryItems.reduce((sum, item) => sum + item.movements.length, 0);
    const turnoverRate = totalValue > 0 ? (totalMovements * 30) / totalValue : 0;
    
    // Stock by category
    const categoryStock = {};
    inventoryItems.forEach(item => {
      const category = item.category?.name || 'Uncategorized';
      categoryStock[category] = (categoryStock[category] || 0) + (item.currentStock * item.costPrice);
    });
    
    const topCategoriesByValue = Object.entries(categoryStock)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    // Low stock items
    const lowStockItems = inventoryItems
      .filter(item => item.currentStock <= item.reorderPoint)
      .map(item => ({
        name: item.name,
        currentStock: item.currentStock,
        reorderPoint: item.reorderPoint,
        shortage: item.reorderPoint - item.currentStock
      }));
    
    // Slow moving items (based on low turnover)
    const slowMovingItems = inventoryItems
      .filter(item => item.movements.length < 5)
      .map(item => ({
        name: item.name,
        currentStock: item.currentStock,
        value: item.currentStock * item.costPrice,
        movementsCount: item.movements.length
      }))
      .slice(0, 10);
    
    res.json({
      summary: {
        totalItems: inventoryItems.length,
        totalValue: totalValue.toFixed(2),
        turnoverRate: turnoverRate.toFixed(2),
        lowStockCount: lowStockItems.length
      },
      categoryBreakdown: topCategoriesByValue,
      lowStockItems,
      slowMovingItems
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== BRANCH PERFORMANCE ====================

const getBranchPerformance = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        branches: {
          where: { isActive: true },
          include: {
            branchStock: {
              include: {
                item: true
              }
            },
            stockMovements: {
              where: {
                type: 'ISSUE',
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
              }
            }
          }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const branchPerformance = [];
    for (const branch of organization.branches) {
      const totalValue = branch.branchStock.reduce((sum, bs) => sum + (bs.quantity * bs.item.costPrice), 0);
      const totalUsage = branch.stockMovements.length;
      const lowStockCount = branch.branchStock.filter(bs => bs.quantity <= bs.item.reorderPoint).length;
      
      branchPerformance.push({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        metrics: {
          inventoryValue: totalValue.toFixed(2),
          stockMovements: totalUsage,
          lowStockCount,
          healthScore: calculateHealthScore(branch.branchStock)
        }
      });
    }
    
    branchPerformance.sort((a, b) => b.metrics.healthScore - a.metrics.healthScore);
    
    res.json(branchPerformance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const calculateHealthScore = (branchStock) => {
  if (branchStock.length === 0) return 0;
  let score = 100;
  const lowStockCount = branchStock.filter(bs => bs.quantity <= bs.item.reorderPoint).length;
  const outOfStockCount = branchStock.filter(bs => bs.quantity === 0).length;
  score -= (lowStockCount / branchStock.length) * 30;
  score -= (outOfStockCount / branchStock.length) * 40;
  return Math.max(0, Math.min(100, Math.floor(score)));
};

// ==================== SUPPLIER PERFORMANCE ====================

const getSupplierPerformanceReport = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        suppliers: {
          where: { isActive: true },
          include: {
            purchaseOrders: true,
            performance: true,
            localSupplierScores: true
          }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const supplierPerformance = [];
    for (const supplier of organization.suppliers) {
      const totalOrders = supplier.purchaseOrders.length;
      const totalSpent = supplier.purchaseOrders.reduce((sum, po) => sum + po.total, 0);
      const onTimeDeliveries = supplier.purchaseOrders.filter(po => 
        po.deliveryDate && po.deliveryDate <= po.expectedDate
      ).length;
      const onTimeRate = totalOrders > 0 ? (onTimeDeliveries / totalOrders) * 100 : 0;
      const localScore = supplier.localSupplierScores[0]?.score || 0;
      
      supplierPerformance.push({
        id: supplier.id,
        name: supplier.name,
        metrics: {
          totalOrders,
          totalSpent: totalSpent.toFixed(2),
          onTimeRate: onTimeRate.toFixed(1),
          averageLeadTime: supplier.leadTime || 0,
          rating: supplier.rating,
          localScore
        }
      });
    }
    
    supplierPerformance.sort((a, b) => b.metrics.onTimeRate - a.metrics.onTimeRate);
    
    res.json({
      summary: {
        totalSuppliers: supplierPerformance.length,
        averageOnTimeRate: (supplierPerformance.reduce((sum, s) => sum + parseFloat(s.metrics.onTimeRate), 0) / supplierPerformance.length).toFixed(1),
        totalSpent: supplierPerformance.reduce((sum, s) => sum + parseFloat(s.metrics.totalSpent), 0).toFixed(2)
      },
      suppliers: supplierPerformance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== TREND ANALYTICS ====================

const getTrendAnalytics = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { days = 30 } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Daily spend trend
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: organization.id,
        orderDate: { gte: startDate }
      }
    });
    
    const dailySpend = {};
    purchaseOrders.forEach(po => {
      const date = po.orderDate.toISOString().split('T')[0];
      dailySpend[date] = (dailySpend[date] || 0) + po.total;
    });
    
    // Stock movement trend
    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        organizationId: organization.id,
        createdAt: { gte: startDate }
      }
    });
    
    const dailyMovements = {};
    stockMovements.forEach(m => {
      const date = m.createdAt.toISOString().split('T')[0];
      if (!dailyMovements[date]) {
        dailyMovements[date] = { receive: 0, issue: 0, wastage: 0 };
      }
      if (m.type === 'RECEIVE') dailyMovements[date].receive += m.quantity;
      else if (m.type === 'ISSUE') dailyMovements[date].issue += m.quantity;
      else if (m.type === 'WASTAGE') dailyMovements[date].wastage += m.quantity;
    });
    
    // Delivery trend
    const deliveries = await prisma.supplierDelivery.findMany({
      where: {
        organizationId: organization.id,
        expectedDate: { gte: startDate }
      }
    });
    
    const dailyDeliveries = {};
    deliveries.forEach(d => {
      const date = d.expectedDate.toISOString().split('T')[0];
      dailyDeliveries[date] = (dailyDeliveries[date] || 0) + 1;
    });
    
    res.json({
      period: `${days} days`,
      dailySpend: Object.entries(dailySpend).map(([date, amount]) => ({ date, amount })),
      dailyStockMovements: Object.entries(dailyMovements).map(([date, data]) => ({ date, ...data })),
      dailyDeliveries: Object.entries(dailyDeliveries).map(([date, count]) => ({ date, count }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== KPI SUMMARY ====================

const getKPISummary = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);
    startOfYear.setHours(0, 0, 0, 0);
    
    // Get data
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { organizationId: organization.id }
    });
    
    const monthlyOrders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: organization.id,
        orderDate: { gte: startOfMonth }
      }
    });
    
    const yearlyOrders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: organization.id,
        orderDate: { gte: startOfYear }
      }
    });
    
    const deliveries = await prisma.supplierDelivery.findMany({
      where: {
        organizationId: organization.id,
        expectedDate: { gte: startOfMonth }
      }
    });
    
    const totalStockValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0);
    const monthlySpend = monthlyOrders.reduce((sum, po) => sum + po.total, 0);
    const yearlySpend = yearlyOrders.reduce((sum, po) => sum + po.total, 0);
    const lowStockCount = inventoryItems.filter(item => item.currentStock <= item.reorderPoint).length;
    const onTimeDeliveries = deliveries.filter(d => d.status === 'DELIVERED' && d.actualDate <= d.expectedDate).length;
    const deliveryRate = deliveries.length > 0 ? (onTimeDeliveries / deliveries.length) * 100 : 0;
    
    // Calculate savings (simplified - compare to expected prices)
    const potentialSavings = monthlySpend * 0.15; // 15% potential savings through optimization
    
    res.json({
      period: {
        month: startOfMonth.toISOString().split('T')[0],
        year: startOfYear.getFullYear()
      },
      financial: {
        monthlySpend: monthlySpend.toFixed(2),
        yearlySpend: yearlySpend.toFixed(2),
        inventoryValue: totalStockValue.toFixed(2),
        potentialSavings: potentialSavings.toFixed(2)
      },
      operational: {
        lowStockCount,
        onTimeDeliveryRate: deliveryRate.toFixed(1),
        totalOrders: monthlyOrders.length,
        totalDeliveries: deliveries.length
      },
      alerts: {
        critical: lowStockCount > 10 ? 'High number of low stock items' : null,
        warning: deliveryRate < 80 ? 'Delivery on-time rate below 80%' : null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDashboard,
  getSpendAnalytics,
  getInventoryAnalytics,
  getBranchPerformance,
  getSupplierPerformanceReport,
  getTrendAnalytics,
  getKPISummary
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to check if retail models exist
const checkRetailModels = async () => {
  try {
    // Try to query the retail product model to see if it exists
    await prisma.retailProduct.findFirst({ take: 1 });
    return true;
  } catch (error) {
    console.error('Retail models not available. Please run: npx prisma generate');
    return false;
  }
};

// ==================== PRODUCTS ====================

const createProduct = async (req, res) => {
  try {
    if (!(await checkRetailModels())) {
      return res.status(500).json({ error: 'Retail models not initialized. Please run npx prisma generate' });
    }

    const { name, sku, barcode, description, category, subcategory, brand, size, color, weight, currentStock, minimumStock, maximumStock, reorderPoint, costPrice, sellingPrice, taxRate, supplierId, location } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const product = await prisma.retailProduct.create({
      data: {
        name, 
        sku, 
        barcode, 
        description, 
        category, 
        subcategory, 
        brand, 
        size, 
        color, 
        weight,
        currentStock: currentStock || 0,
        minimumStock: minimumStock || 0,
        maximumStock: maximumStock || 0,
        reorderPoint: reorderPoint || 0,
        costPrice, 
        sellingPrice, 
        taxRate: taxRate || 16,
        supplierId, 
        location,
        organizationId: organization.id
      },
      include: { supplier: true }
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { category, brand, lowStock, search } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (category) whereClause.category = category;
    if (brand) whereClause.brand = brand;
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const products = await prisma.retailProduct.findMany({
      where: whereClause,
      include: { supplier: true, branchStock: { include: { branch: true } } },
      orderBy: { name: 'asc' }
    });
    
    // Filter low stock in memory
    let filteredProducts = products;
    if (lowStock === 'true') {
      filteredProducts = products.filter(p => p.currentStock <= p.reorderPoint);
    }
    
    res.json(filteredProducts);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, barcode, description, category, subcategory, brand, size, color, weight, minimumStock, maximumStock, reorderPoint, costPrice, sellingPrice, taxRate, location, isActive } = req.body;
    
    const product = await prisma.retailProduct.update({
      where: { id },
      data: { 
        name, sku, barcode, description, category, subcategory, brand, 
        size, color, weight, minimumStock, maximumStock, reorderPoint, 
        costPrice, sellingPrice, taxRate, location, isActive 
      }
    });
    
    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== BRANCH STOCK ====================

const updateBranchStock = async (req, res) => {
  try {
    const { productId, branchId, quantity } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const branchStock = await prisma.retailBranchStock.upsert({
      where: {
        productId_branchId: {
          productId,
          branchId
        }
      },
      update: { quantity, availableStock: quantity },
      create: {
        productId,
        branchId,
        quantity,
        availableStock: quantity,
        reservedStock: 0
      }
    });
    
    // Also update main product currentStock
    await prisma.retailProduct.update({
      where: { id: productId },
      data: { currentStock: quantity }
    });
    
    res.json(branchStock);
  } catch (error) {
    console.error('Update branch stock error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getBranchStock = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { branchId, category, lowStock } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = {};
    if (branchId) {
      whereClause = { branchId };
    }
    
    const branchStock = await prisma.retailBranchStock.findMany({
      where: whereClause,
      include: {
        product: true,
        branch: true
      }
    });
    
    let filtered = branchStock;
    if (category) {
      filtered = filtered.filter(bs => bs.product?.category === category);
    }
    if (lowStock === 'true') {
      filtered = filtered.filter(bs => bs.quantity <= (bs.product?.reorderPoint || 0));
    }
    
    res.json(filtered);
  } catch (error) {
    console.error('Get branch stock error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== TRANSFERS ====================

const createTransfer = async (req, res) => {
  try {
    const { fromBranchId, toBranchId, productId, quantity, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user?.userId || req.headers['x-user-id'] || 'system';
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const sourceStock = await prisma.retailBranchStock.findUnique({
      where: {
        productId_branchId: {
          productId,
          branchId: fromBranchId
        }
      }
    });
    
    if (!sourceStock || sourceStock.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock in source branch' });
    }
    
    const count = await prisma.retailTransfer.count();
    const transferNumber = `TRF-${String(count + 1).padStart(6, '0')}`;
    
    const transfer = await prisma.retailTransfer.create({
      data: {
        transferNumber,
        fromBranchId,
        toBranchId,
        productId,
        quantity,
        requestedBy: userId,
        notes,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(transfer);
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({ error: error.message });
  }
};

const approveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.headers['x-user-id'] || 'system';
    
    const transfer = await prisma.retailTransfer.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: userId
      }
    });
    
    res.json({ message: 'Transfer approved', transfer });
  } catch (error) {
    console.error('Approve transfer error:', error);
    res.status(500).json({ error: error.message });
  }
};

const completeTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transfer = await prisma.retailTransfer.findUnique({
      where: { id }
    });
    
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }
    
    // Deduct from source branch
    await prisma.retailBranchStock.update({
      where: {
        productId_branchId: {
          productId: transfer.productId,
          branchId: transfer.fromBranchId
        }
      },
      data: { quantity: { decrement: transfer.quantity } }
    });
    
    // Add to destination branch
    const destStock = await prisma.retailBranchStock.findUnique({
      where: {
        productId_branchId: {
          productId: transfer.productId,
          branchId: transfer.toBranchId
        }
      }
    });
    
    if (destStock) {
      await prisma.retailBranchStock.update({
        where: {
          productId_branchId: {
            productId: transfer.productId,
            branchId: transfer.toBranchId
          }
        },
        data: { quantity: { increment: transfer.quantity } }
      });
    } else {
      await prisma.retailBranchStock.create({
        data: {
          productId: transfer.productId,
          branchId: transfer.toBranchId,
          quantity: transfer.quantity,
          availableStock: transfer.quantity,
          reservedStock: 0
        }
      });
    }
    
    const updatedTransfer = await prisma.retailTransfer.update({
      where: { id },
      data: {
        status: 'received',
        completedAt: new Date()
      }
    });
    
    res.json({ message: 'Transfer completed', transfer: updatedTransfer });
  } catch (error) {
    console.error('Complete transfer error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getTransfers = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status, fromBranchId, toBranchId } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    if (fromBranchId) whereClause.fromBranchId = fromBranchId;
    if (toBranchId) whereClause.toBranchId = toBranchId;
    
    const transfers = await prisma.retailTransfer.findMany({
      where: whereClause,
      include: {
        fromBranch: true,
        toBranch: true,
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(transfers);
  } catch (error) {
    console.error('Get transfers error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== REORDER ENGINE ====================

const generateReorderSuggestions = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const products = await prisma.retailProduct.findMany({
      where: {
        organizationId: organization.id,
        isActive: true
      },
      include: {
        branchStock: true
      }
    });
    
    const suggestions = [];
    for (const product of products) {
      const totalStock = product.branchStock.reduce((sum, bs) => sum + bs.quantity, 0);
      if (totalStock <= product.reorderPoint) {
        const shortage = product.reorderPoint - totalStock;
        const suggestedQty = Math.ceil(shortage * 1.2);
        const avgDailyDemand = product.minimumStock > 0 ? product.minimumStock / 30 : 1;
        const daysOfStock = avgDailyDemand > 0 ? Math.floor(totalStock / avgDailyDemand) : 0;
        
        let urgency = 'low';
        if (totalStock === 0) urgency = 'critical';
        else if (shortage > product.reorderPoint * 0.7) urgency = 'high';
        else if (shortage > product.reorderPoint * 0.3) urgency = 'medium';
        
        await prisma.reorderEngine.create({
          data: {
            productId: product.id,
            currentStock: totalStock,
            reorderPoint: product.reorderPoint,
            suggestedQty,
            daysOfStock,
            urgency,
            organizationId: organization.id
          }
        });
        
        suggestions.push({
          product: product.name,
          sku: product.sku,
          currentStock: totalStock,
          reorderPoint: product.reorderPoint,
          suggestedQty,
          daysOfStock,
          urgency
        });
      }
    }
    
    res.json({
      summary: {
        totalProducts: products.length,
        productsNeedingReorder: suggestions.length,
        criticalCount: suggestions.filter(s => s.urgency === 'critical').length,
        highCount: suggestions.filter(s => s.urgency === 'high').length,
        mediumCount: suggestions.filter(s => s.urgency === 'medium').length,
        lowCount: suggestions.filter(s => s.urgency === 'low').length
      },
      suggestions
    });
  } catch (error) {
    console.error('Generate reorder suggestions error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== RETAIL DASHBOARD ====================

const getRetailDashboard = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const totalProducts = await prisma.retailProduct.count({
      where: { organizationId: organization.id }
    });
    
    const allProducts = await prisma.retailProduct.findMany({
      where: { organizationId: organization.id }
    });
    
    const lowStockProducts = allProducts.filter(p => p.currentStock <= p.reorderPoint).length;
    
    const pendingTransfers = await prisma.retailTransfer.count({
      where: {
        organizationId: organization.id,
        status: 'pending'
      }
    });
    
    const recentSales = await prisma.retailSale.findMany({
      where: { organizationId: organization.id },
      orderBy: { saleDate: 'desc' },
      take: 10,
      include: {
        product: true,
        branch: true
      }
    });
    
    const totalSales = await prisma.retailSale.aggregate({
      where: { organizationId: organization.id },
      _sum: { finalPrice: true }
    });
    
    // Get category breakdown
    const categoryBreakdown = {};
    allProducts.forEach(p => {
      if (p.category) {
        categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + p.currentStock;
      }
    });
    
    res.json({
      metrics: {
        totalProducts,
        lowStockProducts,
        pendingTransfers,
        totalSalesValue: totalSales._sum.finalPrice || 0,
        stockValue: allProducts.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0)
      },
      categoryBreakdown,
      recentSales
    });
  } catch (error) {
    console.error('Get retail dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  updateBranchStock,
  getBranchStock,
  createTransfer,
  approveTransfer,
  completeTransfer,
  getTransfers,
  generateReorderSuggestions,
  getRetailDashboard
};
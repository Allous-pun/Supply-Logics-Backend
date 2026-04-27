const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== BRANCH STOCK LEVELS ====================

const getBranchStock = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { branchId, categoryId, lowStock } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { branchId };
    if (branchId) {
      whereClause.branchId = branchId;
    }
    
    const branchStock = await prisma.branchStock.findMany({
      where: whereClause,
      include: {
        item: {
          include: {
            category: true
          }
        },
        branch: true
      }
    });
    
    // Filter by category if specified
    let filteredStock = branchStock;
    if (categoryId) {
      filteredStock = branchStock.filter(bs => bs.item.categoryId === categoryId);
    }
    
    // Filter low stock
    if (lowStock === 'true') {
      filteredStock = filteredStock.filter(bs => bs.quantity <= bs.item.reorderPoint);
    }
    
    res.json(filteredStock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBranchStockByItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const branchStock = await prisma.branchStock.findMany({
      where: { itemId },
      include: {
        branch: true,
        item: true
      }
    });
    
    res.json(branchStock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateBranchStock = async (req, res) => {
  try {
    const { branchId, itemId, quantity } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const branchStock = await prisma.branchStock.upsert({
      where: {
        branchId_itemId: {
          branchId,
          itemId
        }
      },
      update: {
        quantity,
        availableStock: quantity
      },
      create: {
        branchId,
        itemId,
        quantity,
        availableStock: quantity,
        reservedStock: 0
      }
    });
    
    res.json(branchStock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== STOCK REQUESTS ====================

const createStockRequest = async (req, res) => {
  try {
    const { fromBranchId, toBranchId, items, notes, priority } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Generate request number
    const count = await prisma.stockMovement.count({
      where: { organizationId: organization.id, type: 'TRANSFER_OUT' }
    });
    const requestNumber = `TRF-${String(count + 1).padStart(6, '0')}`;
    
    // Create transfer record as stock movements
    const transfers = [];
    for (const item of items) {
      // Check if source branch has enough stock
      const sourceStock = await prisma.branchStock.findUnique({
        where: {
          branchId_itemId: {
            branchId: fromBranchId,
            itemId: item.itemId
          }
        }
      });
      
      if (!sourceStock || sourceStock.quantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for item ${item.itemId} in source branch` 
        });
      }
      
      // Deduct from source branch
      await prisma.branchStock.update({
        where: { id: sourceStock.id },
        data: {
          quantity: sourceStock.quantity - item.quantity,
          availableStock: sourceStock.availableStock - item.quantity
        }
      });
      
      // Record movement out
      const movementOut = await prisma.stockMovement.create({
        data: {
          itemId: item.itemId,
          branchId: fromBranchId,
          quantity: -item.quantity,
          type: 'TRANSFER_OUT',
          reference: requestNumber,
          previousStock: sourceStock.quantity,
          newStock: sourceStock.quantity - item.quantity,
          notes: `Transfer to ${toBranchId}. ${notes || ''}`,
          createdBy: userId,
          organizationId: organization.id
        }
      });
      
      // Add to destination branch
      const destStock = await prisma.branchStock.findUnique({
        where: {
          branchId_itemId: {
            branchId: toBranchId,
            itemId: item.itemId
          }
        }
      });
      
      if (destStock) {
        await prisma.branchStock.update({
          where: { id: destStock.id },
          data: {
            quantity: destStock.quantity + item.quantity,
            availableStock: destStock.availableStock + item.quantity
          }
        });
      } else {
        await prisma.branchStock.create({
          data: {
            branchId: toBranchId,
            itemId: item.itemId,
            quantity: item.quantity,
            availableStock: item.quantity,
            reservedStock: 0
          }
        });
      }
      
      // Record movement in
      await prisma.stockMovement.create({
        data: {
          itemId: item.itemId,
          branchId: toBranchId,
          quantity: item.quantity,
          type: 'TRANSFER_IN',
          reference: requestNumber,
          previousStock: destStock?.quantity || 0,
          newStock: (destStock?.quantity || 0) + item.quantity,
          notes: `Transfer from ${fromBranchId}. ${notes || ''}`,
          createdBy: userId,
          organizationId: organization.id
        }
      });
      
      transfers.push(movementOut);
    }
    
    res.status(201).json({
      message: 'Stock transfer completed successfully',
      requestNumber,
      transfers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStockRequests = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { branchId, type } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (type === 'out' && branchId) {
      whereClause = { ...whereClause, branchId, type: 'TRANSFER_OUT' };
    } else if (type === 'in' && branchId) {
      whereClause = { ...whereClause, branchId, type: 'TRANSFER_IN' };
    }
    
    const transfers = await prisma.stockMovement.findMany({
      where: whereClause,
      include: {
        item: true,
        branch: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== BRANCH REPORTS ====================

const getBranchComparison = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        branches: {
          where: { isActive: true }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const branchComparison = [];
    
    for (const branch of organization.branches) {
      const branchStock = await prisma.branchStock.findMany({
        where: { branchId: branch.id },
        include: {
          item: true
        }
      });
      
      const totalValue = branchStock.reduce((sum, bs) => sum + (bs.quantity * bs.item.costPrice), 0);
      const lowStockItems = branchStock.filter(bs => bs.quantity <= bs.item.reorderPoint).length;
      const outOfStock = branchStock.filter(bs => bs.quantity === 0).length;
      
      branchComparison.push({
        branch: {
          id: branch.id,
          name: branch.name,
          code: branch.code
        },
        metrics: {
          totalItems: branchStock.length,
          totalValue,
          lowStockItems,
          outOfStock,
          healthScore: calculateHealthScore(branchStock)
        }
      });
    }
    
    // Sort by health score
    branchComparison.sort((a, b) => b.metrics.healthScore - a.metrics.healthScore);
    
    res.json(branchComparison);
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
  
  return Math.max(0, Math.min(100, score));
};

const getBranchInventoryValue = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { branchId } = req.params;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const branchStock = await prisma.branchStock.findMany({
      where: { branchId },
      include: {
        item: {
          include: {
            category: true
          }
        }
      }
    });
    
    const byCategory = {};
    let totalValue = 0;
    
    for (const bs of branchStock) {
      const value = bs.quantity * bs.item.costPrice;
      totalValue += value;
      
      const categoryName = bs.item.category?.name || 'Uncategorized';
      if (!byCategory[categoryName]) {
        byCategory[categoryName] = 0;
      }
      byCategory[categoryName] += value;
    }
    
    res.json({
      branchId,
      totalValue,
      byCategory,
      items: branchStock.map(bs => ({
        itemId: bs.item.id,
        itemName: bs.item.name,
        quantity: bs.quantity,
        costPrice: bs.item.costPrice,
        value: bs.quantity * bs.item.costPrice,
        reorderPoint: bs.item.reorderPoint,
        status: bs.quantity <= bs.item.reorderPoint ? 'Low Stock' : 'OK'
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REORDER SUGGESTIONS BY BRANCH ====================

const getBranchReorderSuggestions = async (req, res) => {
  try {
    const { branchId } = req.params;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const branchStock = await prisma.branchStock.findMany({
      where: { branchId },
      include: {
        item: true
      }
    });
    
    const suggestions = [];
    for (const bs of branchStock) {
      if (bs.quantity <= bs.item.reorderPoint) {
        const shortage = bs.item.reorderPoint - bs.quantity;
        const suggestedQty = Math.ceil(shortage * 1.2);
        
        suggestions.push({
          itemId: bs.item.id,
          itemName: bs.item.name,
          currentStock: bs.quantity,
          reorderPoint: bs.item.reorderPoint,
          suggestedQty,
          urgency: bs.quantity === 0 ? 'URGENT' : (shortage > bs.item.reorderPoint * 0.5 ? 'HIGH' : 'MEDIUM')
        });
      }
    }
    
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  // Branch Stock
  getBranchStock,
  getBranchStockByItem,
  updateBranchStock,
  // Stock Requests / Transfers
  createStockRequest,
  getStockRequests,
  // Branch Reports
  getBranchComparison,
  getBranchInventoryValue,
  getBranchReorderSuggestions
};

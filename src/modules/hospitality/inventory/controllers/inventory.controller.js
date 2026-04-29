const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== CATEGORIES ====================

const getCategories = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const categories = await prisma.inventoryCategory.findMany({
      where: { organizationId: organization.id },
      include: {
        items: true
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const category = await prisma.inventoryCategory.create({
      data: {
        name,
        description,
        color,
        icon,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon } = req.body;
    
    const category = await prisma.inventoryCategory.update({
      where: { id },
      data: { name, description, color, icon }
    });
    
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category has items
    const itemCount = await prisma.inventoryItem.count({
      where: { categoryId: id }
    });
    
    if (itemCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with existing items' });
    }
    
    await prisma.inventoryCategory.delete({ where: { id } });
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== INVENTORY ITEMS ====================

const getItems = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { categoryId, lowStock, search } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (lowStock === 'true') {
      whereClause.currentStock = { lte: prisma.inventoryItem.fields.reorderPoint };
    }
    
    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      include: {
        category: true,
        supplier: true
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        branchStock: {
          include: {
            branch: true
          }
        }
      }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createItem = async (req, res) => {
  try {
    const {
      name, sku, barcode, description, categoryId, unit,
      minimumStock, maximumStock, reorderPoint, costPrice,
      sellingPrice, location, supplierId
    } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const item = await prisma.inventoryItem.create({
      data: {
        name,
        sku,
        barcode,
        description,
        categoryId,
        unit,
        minimumStock: minimumStock || 0,
        maximumStock: maximumStock || 0,
        reorderPoint: reorderPoint || 0,
        costPrice: costPrice || 0,
        sellingPrice: sellingPrice || 0,
        location,
        supplierId,
        organizationId: organization.id
      },
      include: {
        category: true,
        supplier: true
      }
    });
    
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, sku, barcode, description, categoryId, unit,
      minimumStock, maximumStock, reorderPoint, costPrice,
      sellingPrice, location, supplierId, isActive
    } = req.body;
    
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name, sku, barcode, description, categoryId, unit,
        minimumStock, maximumStock, reorderPoint, costPrice,
        sellingPrice, location, supplierId, isActive
      },
      include: {
        category: true,
        supplier: true
      }
    });
    
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item has movements
    const movementCount = await prisma.stockMovement.count({
      where: { itemId: id }
    });
    
    if (movementCount > 0) {
      return res.status(400).json({ error: 'Cannot delete item with stock movement history' });
    }
    
    await prisma.inventoryItem.delete({ where: { id } });
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== STOCK MOVEMENTS ====================

const receiveStock = async (req, res) => {
  try {
    const { itemId, quantity, reference, notes, branchId } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const previousStock = item.currentStock;
    const newStock = previousStock + quantity;
    
    // Update item stock
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: newStock }
    });
    
    // Create movement record
    const movement = await prisma.stockMovement.create({
      data: {
        itemId,
        branchId,
        quantity,
        type: 'RECEIVE',
        reference,
        previousStock,
        newStock,
        notes,
        createdBy: userId,
        organizationId: organization.id
      }
    });
    
    // Update branch stock if branch specified
    if (branchId) {
      const existingBranchStock = await prisma.branchStock.findUnique({
        where: {
          branchId_itemId: {
            branchId,
            itemId
          }
        }
      });
      
      if (existingBranchStock) {
        await prisma.branchStock.update({
          where: { id: existingBranchStock.id },
          data: {
            quantity: existingBranchStock.quantity + quantity,
            availableStock: existingBranchStock.availableStock + quantity
          }
        });
      } else {
        await prisma.branchStock.create({
          data: {
            branchId,
            itemId,
            quantity,
            availableStock: quantity,
            reservedStock: 0
          }
        });
      }
    }
    
    // Check low stock alert
    if (newStock <= item.reorderPoint) {
      await prisma.lowStockAlert.create({
        data: {
          itemId,
          branchId,
          currentStock: newStock,
          reorderPoint: item.reorderPoint
        }
      });
    }
    
    res.json({
      message: 'Stock received successfully',
      movement,
      newStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const issueStock = async (req, res) => {
  try {
    const { itemId, quantity, reference, notes, branchId } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    if (item.currentStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const previousStock = item.currentStock;
    const newStock = previousStock - quantity;
    
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: newStock }
    });
    
    const movement = await prisma.stockMovement.create({
      data: {
        itemId,
        branchId,
        quantity,
        type: 'ISSUE',
        reference,
        previousStock,
        newStock,
        notes,
        createdBy: userId,
        organizationId: organization.id
      }
    });
    
    // Update branch stock
    if (branchId) {
      const branchStock = await prisma.branchStock.findUnique({
        where: {
          branchId_itemId: {
            branchId,
            itemId
          }
        }
      });
      
      if (branchStock) {
        await prisma.branchStock.update({
          where: { id: branchStock.id },
          data: {
            quantity: branchStock.quantity - quantity,
            availableStock: branchStock.availableStock - quantity
          }
        });
      }
    }
    
    res.json({
      message: 'Stock issued successfully',
      movement,
      newStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { itemId, quantity, reason, notes, branchId } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const previousStock = item.currentStock;
    const newStock = previousStock + quantity;
    
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: newStock }
    });
    
    const movement = await prisma.stockMovement.create({
      data: {
        itemId,
        branchId,
        quantity,
        type: 'ADJUST',
        reference: reason,
        previousStock,
        newStock,
        notes,
        createdBy: userId,
        organizationId: organization.id
      }
    });
    
    res.json({
      message: 'Stock adjusted successfully',
      movement,
      newStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET MOVEMENTS (NEW) ====================

const getMovements = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { itemId } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (itemId) {
      whereClause.itemId = itemId;
    }
    
    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== LOW STOCK ALERTS ====================

const getLowStockAlerts = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = {
      item: { organizationId: organization.id }
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    const alerts = await prisma.lowStockAlert.findMany({
      where: whereClause,
      include: {
        item: {
          include: {
            category: true
          }
        },
        branch: true
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
    
    const alert = await prisma.lowStockAlert.update({
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

// ==================== BRANCH STOCK ====================

const getBranchStock = async (req, res) => {
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
        item: {
          include: {
            category: true
          }
        },
        branch: true
      }
    });
    
    res.json(branchStock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  // Categories
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Items
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  // Movements
  receiveStock,
  issueStock,
  adjustStock,
  getMovements,  // ADDED
  // Alerts
  getLowStockAlerts,
  resolveAlert,
  // Branch Stock
  getBranchStock
};
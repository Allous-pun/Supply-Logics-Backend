const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate unique numbers
const generateRequestNumber = async () => {
  const count = await prisma.purchaseRequest.count();
  return `PR-${String(count + 1).padStart(6, '0')}`;
};

const generatePONumber = async () => {
  const count = await prisma.purchaseOrder.count();
  return `PO-${String(count + 1).padStart(6, '0')}`;
};

const generateGRNNumber = async () => {
  const count = await prisma.goodsReceiptNote.count();
  return `GRN-${String(count + 1).padStart(6, '0')}`;
};

// ==================== PURCHASE REQUESTS ====================

const createPurchaseRequest = async (req, res) => {
  try {
    const { title, description, requiredDate, items, priority, budgetCode, department } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const requestNumber = await generateRequestNumber();
    
    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        requestNumber,
        title,
        description,
        requestedBy: userId,
        requiredDate: new Date(requiredDate),
        items,
        priority,
        budgetCode,
        department,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(purchaseRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPurchaseRequests = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status, priority, department } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    if (priority) whereClause.priority = priority;
    if (department) whereClause.department = department;
    
    const requests = await prisma.purchaseRequest.findMany({
      where: whereClause,
      include: {
        purchaseOrders: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPurchaseRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          include: {
            supplier: true
          }
        }
      }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const approvePurchaseRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const userId = req.user.userId;
    
    const request = await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionReason: approved ? null : req.body.rejectionReason
      }
    });
    
    res.json({
      message: `Request ${approved ? 'approved' : 'rejected'} successfully`,
      request
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== PURCHASE ORDERS ====================

const createPurchaseOrder = async (req, res) => {
  try {
    const { supplierId, requestId, expectedDate, items, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const poNumber = await generatePONumber();
    
    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.unitPrice;
    }
    const total = subtotal;
    
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        requestId,
        expectedDate: new Date(expectedDate),
        items,
        subtotal,
        total,
        notes,
        organizationId: organization.id
      },
      include: {
        supplier: true
      }
    });
    
    // Update request status if linked
    if (requestId) {
      await prisma.purchaseRequest.update({
        where: { id: requestId },
        data: { status: 'ORDERED' }
      });
    }
    
    res.status(201).json(purchaseOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPurchaseOrders = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status, supplierId } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    if (supplierId) whereClause.supplierId = supplierId;
    
    const orders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        supplier: true,
        request: true,
        receipts: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        request: true,
        receipts: true
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status }
    });
    
    res.json({
      message: `Order status updated to ${status}`,
      order
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GOODS RECEIPT NOTES ====================

const createGoodsReceipt = async (req, res) => {
  try {
    const { poId, items, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user.userId;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const grnNumber = await generateGRNNumber();
    
    const receipt = await prisma.goodsReceiptNote.create({
      data: {
        grnNumber,
        poId,
        items,
        receivedBy: userId,
        notes,
        organizationId: organization.id
      }
    });
    
    // Update inventory for accepted items
    for (const item of items) {
      if (item.acceptedQuantity > 0) {
        await prisma.inventoryItem.update({
          where: { id: item.itemId },
          data: {
            currentStock: {
              increment: item.acceptedQuantity
            }
          }
        });
        
        // Record stock movement
        await prisma.stockMovement.create({
          data: {
            itemId: item.itemId,
            quantity: item.acceptedQuantity,
            type: 'RECEIVE',
            reference: grnNumber,
            previousStock: 0, // Will be updated by trigger
            newStock: 0,
            notes: `GRN: ${grnNumber} for PO: ${poId}`,
            createdBy: userId,
            organizationId: organization.id
          }
        });
      }
    }
    
    // Update PO status
    const allItemsAccepted = items.every(i => i.rejectedQuantity === 0);
    const partialAccepted = items.some(i => i.acceptedQuantity > 0 && i.rejectedQuantity > 0);
    
    let poStatus = 'DELIVERED';
    if (partialAccepted) poStatus = 'PARTIAL';
    
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: poStatus,
        deliveryDate: new Date()
      }
    });
    
    res.status(201).json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getGoodsReceipts = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const receipts = await prisma.goodsReceiptNote.findMany({
      where: { organizationId: organization.id },
      include: {
        purchaseOrder: {
          include: {
            supplier: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REORDER SUGGESTIONS ====================

const getReorderSuggestions = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Find items below reorder point
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        organizationId: organization.id,
        currentStock: { lte: prisma.inventoryItem.fields.reorderPoint },
        isActive: true
      },
      include: {
        category: true,
        supplier: true
      }
    });
    
    const suggestions = [];
    for (const item of lowStockItems) {
      const shortage = item.reorderPoint - item.currentStock;
      const suggestedQty = Math.ceil(shortage * 1.2); // 20% buffer
      
      suggestions.push({
        itemId: item.id,
        itemName: item.name,
        currentStock: item.currentStock,
        reorderPoint: item.reorderPoint,
        suggestedQty,
        reason: `Current stock (${item.currentStock}) is below reorder point (${item.reorderPoint})`,
        supplier: item.supplier
      });
    }
    
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createReorderSuggestions = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        organizationId: organization.id,
        currentStock: { lte: prisma.inventoryItem.fields.reorderPoint },
        isActive: true
      }
    });
    
    const createdSuggestions = [];
    for (const item of lowStockItems) {
      const shortage = item.reorderPoint - item.currentStock;
      const suggestedQty = Math.ceil(shortage * 1.2);
      
      const suggestion = await prisma.reorderSuggestion.create({
        data: {
          itemId: item.id,
          currentStock: item.currentStock,
          reorderPoint: item.reorderPoint,
          suggestedQty,
          reason: `Current stock (${item.currentStock}) is below reorder point (${item.reorderPoint})`
        }
      });
      createdSuggestions.push(suggestion);
    }
    
    res.status(201).json(createdSuggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  // Purchase Requests
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  approvePurchaseRequest,
  // Purchase Orders
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updateOrderStatus,
  // Goods Receipt
  createGoodsReceipt,
  getGoodsReceipts,
  // Reorder Suggestions
  getReorderSuggestions,
  createReorderSuggestions
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== RAW MATERIALS ====================

const createRawMaterial = async (req, res) => {
  try {
    const { name, sku, barcode, description, category, unit, currentStock, minimumStock, maximumStock, reorderPoint, unitCost, supplierId, storageLocation, qualityGrade, expiryDate, isHazardous } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Check if SKU already exists
    const existingMaterial = await prisma.rawMaterial.findUnique({
      where: { sku }
    });
    
    if (existingMaterial) {
      return res.status(400).json({ error: `Raw material with SKU ${sku} already exists` });
    }
    
    const material = await prisma.rawMaterial.create({
      data: {
        name, 
        sku, 
        barcode, 
        description, 
        category, 
        unit,
        currentStock: currentStock || 0,
        minimumStock: minimumStock || 0,
        maximumStock: maximumStock || 0,
        reorderPoint: reorderPoint || 0,
        unitCost, 
        supplierId, 
        storageLocation, 
        qualityGrade,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isHazardous: isHazardous || false,
        organizationId: organization.id
      },
      include: { supplier: true }
    });
    
    res.status(201).json(material);
  } catch (error) {
    console.error('Create raw material error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

const getRawMaterials = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { category, lowStock, search } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (category) whereClause.category = category;
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const materials = await prisma.rawMaterial.findMany({
      where: whereClause,
      include: { supplier: true, branchStock: { include: { branch: true } } },
      orderBy: { name: 'asc' }
    });
    
    // Filter low stock in memory
    let filteredMaterials = materials;
    if (lowStock === 'true') {
      filteredMaterials = materials.filter(m => m.currentStock <= m.reorderPoint);
    }
    
    res.json(filteredMaterials);
  } catch (error) {
    console.error('Get raw materials error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== WORK ORDERS ====================

const createWorkOrder = async (req, res) => {
  try {
    const { productName, productCode, quantity, priority, startDate, dueDate, assignedTo, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const count = await prisma.workOrder.count();
    const orderNumber = `WO-${String(count + 1).padStart(6, '0')}`;
    
    const workOrder = await prisma.workOrder.create({
      data: {
        orderNumber,
        productName,
        productCode,
        quantity,
        priority: priority || 'medium',
        startDate: new Date(startDate),
        dueDate: new Date(dueDate),
        assignedTo,
        notes,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(workOrder);
  } catch (error) {
    console.error('Create work order error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getWorkOrders = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status, priority } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    if (priority) whereClause.priority = priority;
    
    const workOrders = await prisma.workOrder.findMany({
      where: whereClause,
      include: {
        inputs: { include: { material: true } },
        outputs: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(workOrders);
  } catch (error) {
    console.error('Get work orders error:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateWorkOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completedQty, rejectedQty } = req.body;
    
    const updateData = { status };
    if (completedQty !== undefined) updateData.completedQty = completedQty;
    if (rejectedQty !== undefined) updateData.rejectedQty = rejectedQty;
    if (status === 'completed') updateData.completedDate = new Date();
    
    const workOrder = await prisma.workOrder.update({
      where: { id },
      data: updateData
    });
    
    res.json(workOrder);
  } catch (error) {
    console.error('Update work order status error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== PRODUCTION ====================

const recordMaterialUsage = async (req, res) => {
  try {
    const { workOrderId, materialId, quantityUsed, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    const userId = req.user?.userId || req.headers['x-user-id'] || 'system';
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const material = await prisma.rawMaterial.findUnique({
      where: { id: materialId }
    });
    
    if (!material || material.currentStock < quantityUsed) {
      return res.status(400).json({ error: 'Insufficient raw material stock' });
    }
    
    const previousStock = material.currentStock;
    const newStock = previousStock - quantityUsed;
    
    const usage = await prisma.productionInput.create({
      data: {
        workOrderId,
        materialId,
        quantityUsed,
        unitCost: material.unitCost,
        totalCost: quantityUsed * material.unitCost,
        notes,
        organizationId: organization.id
      }
    });
    
    await prisma.rawMaterial.update({
      where: { id: materialId },
      data: { currentStock: newStock }
    });
    
    await prisma.rawMaterialMovement.create({
      data: {
        materialId,
        quantity: -quantityUsed,
        type: 'ISSUED_TO_PRODUCTION',
        reference: workOrderId,
        previousStock,
        newStock,
        notes,
        createdBy: userId,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(usage);
  } catch (error) {
    console.error('Record material usage error:', error);
    res.status(500).json({ error: error.message });
  }
};

const recordFinishedGoodsOutput = async (req, res) => {
  try {
    const { workOrderId, quantity, batchNumber, qualityStatus, inspectionNotes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId }
    });
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    const output = await prisma.finishedGoodsOutput.create({
      data: {
        workOrderId,
        quantity,
        batchNumber,
        qualityStatus: qualityStatus || 'passed',
        inspectionNotes,
        organizationId: organization.id
      }
    });
    
    const newCompletedQty = workOrder.completedQty + quantity;
    const newStatus = newCompletedQty >= workOrder.quantity ? 'completed' : 'in_progress';
    
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        completedQty: newCompletedQty,
        status: newStatus,
        completedDate: newStatus === 'completed' ? new Date() : null
      }
    });
    
    // Update finished goods inventory - check if exists first
    const finishedGoods = await prisma.finishedGoods.findFirst({
      where: { 
        sku: workOrder.productCode,
        organizationId: organization.id
      }
    });
    
    if (finishedGoods) {
      await prisma.finishedGoods.update({
        where: { id: finishedGoods.id },
        data: { currentStock: { increment: quantity } }
      });
    } else {
      // Create finished goods if doesn't exist - use unique SKU
      const uniqueSku = `${workOrder.productCode}-${Date.now()}`;
      await prisma.finishedGoods.create({
        data: {
          name: workOrder.productName,
          sku: uniqueSku,
          category: 'manufactured',
          unit: 'pieces',
          currentStock: quantity,
          minimumStock: 0,
          maximumStock: workOrder.quantity * 2,
          reorderPoint: Math.ceil(workOrder.quantity * 0.2),
          productionCost: 0,
          sellingPrice: 0,
          organizationId: organization.id
        }
      });
    }
    
    res.status(201).json(output);
  } catch (error) {
    console.error('Record finished goods output error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'SKU conflict. Please use a unique SKU for the finished good.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

// ==================== FINISHED GOODS ====================

const createFinishedGoods = async (req, res) => {
  try {
    const { name, sku, barcode, description, category, unit, currentStock, minimumStock, maximumStock, reorderPoint, productionCost, sellingPrice } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Check if SKU already exists
    const existingProduct = await prisma.finishedGoods.findUnique({
      where: { sku }
    });
    
    if (existingProduct) {
      return res.status(400).json({ error: `Finished good with SKU ${sku} already exists. Please use a different SKU.` });
    }
    
    const product = await prisma.finishedGoods.create({
      data: {
        name, 
        sku, 
        barcode, 
        description, 
        category, 
        unit,
        currentStock: currentStock || 0,
        minimumStock: minimumStock || 0,
        maximumStock: maximumStock || 0,
        reorderPoint: reorderPoint || 0,
        productionCost, 
        sellingPrice,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Create finished goods error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'SKU already exists. Please use a unique SKU.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

const getFinishedGoods = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { category, lowStock } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (category) whereClause.category = category;
    
    const products = await prisma.finishedGoods.findMany({
      where: whereClause,
      include: { branchStock: { include: { branch: true } } },
      orderBy: { name: 'asc' }
    });
    
    let filteredProducts = products;
    if (lowStock === 'true') {
      filteredProducts = products.filter(p => p.currentStock <= p.reorderPoint);
    }
    
    res.json(filteredProducts);
  } catch (error) {
    console.error('Get finished goods error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== DISPATCH ====================

const createDispatch = async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, deliveryAddress, items, vehicleNumber, driverName, driverPhone, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const count = await prisma.dispatch.count();
    const dispatchNumber = `DSP-${String(count + 1).padStart(6, '0')}`;
    
    const dispatch = await prisma.dispatch.create({
      data: {
        dispatchNumber,
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        vehicleNumber,
        driverName,
        driverPhone,
        notes,
        organizationId: organization.id
      }
    });
    
    for (const item of items) {
      await prisma.dispatchItem.create({
        data: {
          dispatchId: dispatch.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          batchNumber: item.batchNumber,
          organizationId: organization.id
        }
      });
      
      // Deduct from finished goods stock
      await prisma.finishedGoods.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } }
      });
    }
    
    res.status(201).json(dispatch);
  } catch (error) {
    console.error('Create dispatch error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getDispatches = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    
    const dispatches = await prisma.dispatch.findMany({
      where: whereClause,
      include: {
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(dispatches);
  } catch (error) {
    console.error('Get dispatches error:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateDispatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const dispatch = await prisma.dispatch.update({
      where: { id },
      data: { status }
    });
    
    res.json(dispatch);
  } catch (error) {
    console.error('Update dispatch status error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MANUFACTURING DASHBOARD ====================

const getManufacturingDashboard = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const totalRawMaterials = await prisma.rawMaterial.count({
      where: { organizationId: organization.id }
    });
    
    const allRawMaterials = await prisma.rawMaterial.findMany({
      where: { organizationId: organization.id }
    });
    const lowStockRaw = allRawMaterials.filter(m => m.currentStock <= m.reorderPoint).length;
    
    const pendingWorkOrders = await prisma.workOrder.count({
      where: {
        organizationId: organization.id,
        status: { in: ['draft', 'approved', 'in_progress'] }
      }
    });
    
    const totalFinishedGoods = await prisma.finishedGoods.count({
      where: { organizationId: organization.id }
    });
    
    const allFinishedGoods = await prisma.finishedGoods.findMany({
      where: { organizationId: organization.id }
    });
    const lowStockFinished = allFinishedGoods.filter(f => f.currentStock <= f.reorderPoint).length;
    
    const pendingDispatches = await prisma.dispatch.count({
      where: {
        organizationId: organization.id,
        status: { in: ['pending', 'loaded', 'in_transit'] }
      }
    });
    
    const completedWorkOrders = await prisma.workOrder.count({
      where: {
        organizationId: organization.id,
        status: 'completed'
      }
    });
    
    const totalProductionOutput = await prisma.finishedGoodsOutput.aggregate({
      where: { organizationId: organization.id },
      _sum: { quantity: true }
    });
    
    res.json({
      metrics: {
        totalRawMaterials,
        lowStockRaw,
        pendingWorkOrders,
        completedWorkOrders,
        totalFinishedGoods,
        lowStockFinished,
        pendingDispatches,
        totalProductionOutput: totalProductionOutput._sum.quantity || 0
      },
      alerts: {
        lowStockRawCount: lowStockRaw,
        lowStockFinishedCount: lowStockFinished,
        pendingWorkOrdersCount: pendingWorkOrders
      }
    });
  } catch (error) {
    console.error('Get manufacturing dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createRawMaterial,
  getRawMaterials,
  createWorkOrder,
  getWorkOrders,
  updateWorkOrderStatus,
  recordMaterialUsage,
  recordFinishedGoodsOutput,
  createFinishedGoods,
  getFinishedGoods,
  createDispatch,
  getDispatches,
  updateDispatchStatus,
  getManufacturingDashboard
};
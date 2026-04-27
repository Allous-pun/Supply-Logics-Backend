const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== BOOKS ====================

const createBook = async (req, res) => {
  try {
    const { title, isbn, author, publisher, edition, category, subject, grade, quantity, minimumStock, costPrice, sellingPrice, supplierId, location, condition } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const book = await prisma.bookInventory.create({
      data: {
        title, 
        isbn, 
        author, 
        publisher, 
        edition, 
        category, 
        subject, 
        grade,
        quantity: quantity || 0,
        minimumStock: minimumStock || 0,
        costPrice, 
        sellingPrice, 
        supplierId, 
        location, 
        condition: condition || 'new',
        organizationId: organization.id
      },
      include: { supplier: true }
    });
    
    res.status(201).json(book);
  } catch (error) {
    console.error('Create book error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getBooks = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { category, subject, grade, lowStock } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (category) whereClause.category = category;
    if (subject) whereClause.subject = subject;
    if (grade) whereClause.grade = grade;
    
    const books = await prisma.bookInventory.findMany({
      where: whereClause,
      include: { supplier: true },
      orderBy: { title: 'asc' }
    });
    
    // Filter low stock in memory since Prisma doesn't support comparing fields directly
    let filteredBooks = books;
    if (lowStock === 'true') {
      filteredBooks = books.filter(book => book.quantity <= book.minimumStock);
    }
    
    res.json(filteredBooks);
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: error.message });
  }
};

const distributeBook = async (req, res) => {
  try {
    const { bookId, studentId, teacherId, quantity, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const book = await prisma.bookInventory.findUnique({
      where: { id: bookId }
    });
    
    if (!book || book.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const distribution = await prisma.bookDistribution.create({
      data: {
        bookId,
        studentId: studentId || null,
        teacherId: teacherId || null,
        quantity,
        status: 'issued',
        notes,
        organizationId: organization.id
      }
    });
    
    await prisma.bookInventory.update({
      where: { id: bookId },
      data: { quantity: book.quantity - quantity }
    });
    
    res.status(201).json(distribution);
  } catch (error) {
    console.error('Distribute book error:', error);
    res.status(500).json({ error: error.message });
  }
};

const returnBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, notes } = req.body;
    
    const distribution = await prisma.bookDistribution.findUnique({
      where: { id },
      include: { book: true }
    });
    
    if (!distribution) {
      return res.status(404).json({ error: 'Distribution record not found' });
    }
    
    await prisma.bookDistribution.update({
      where: { id },
      data: {
        status: condition === 'damaged' ? 'damaged' : condition === 'lost' ? 'lost' : 'returned',
        returnDate: new Date(),
        notes
      }
    });
    
    if (condition !== 'damaged' && condition !== 'lost') {
      await prisma.bookInventory.update({
        where: { id: distribution.bookId },
        data: { quantity: distribution.book.quantity + distribution.quantity }
      });
    }
    
    res.json({ message: 'Book returned successfully' });
  } catch (error) {
    console.error('Return book error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== STATIONERY ====================

const createStationeryItem = async (req, res) => {
  try {
    const { name, sku, category, quantity, minimumStock, unitPrice, supplierId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const item = await prisma.stationeryItem.create({
      data: {
        name, 
        sku, 
        category, 
        quantity: quantity || 0, 
        minimumStock: minimumStock || 0,
        unitPrice, 
        supplierId, 
        organizationId: organization.id
      },
      include: { supplier: true }
    });
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Create stationery error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getStationeryItems = async (req, res) => {
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
    
    const items = await prisma.stationeryItem.findMany({
      where: whereClause,
      include: { supplier: true },
      orderBy: { name: 'asc' }
    });
    
    let filteredItems = items;
    if (lowStock === 'true') {
      filteredItems = items.filter(item => item.quantity <= item.minimumStock);
    }
    
    res.json(filteredItems);
  } catch (error) {
    console.error('Get stationery error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== UNIFORMS ====================

const createUniformItem = async (req, res) => {
  try {
    const { name, code, category, size, gender, quantity, minimumStock, costPrice, sellingPrice, supplierId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const item = await prisma.uniformItem.create({
      data: {
        name, 
        code, 
        category, 
        size, 
        gender, 
        quantity: quantity || 0,
        minimumStock: minimumStock || 0, 
        costPrice, 
        sellingPrice, 
        supplierId,
        organizationId: organization.id
      },
      include: { supplier: true }
    });
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Create uniform error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getUniformItems = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { category, size, gender, lowStock } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (category) whereClause.category = category;
    if (size) whereClause.size = size;
    if (gender) whereClause.gender = gender;
    
    const items = await prisma.uniformItem.findMany({
      where: whereClause,
      include: { supplier: true },
      orderBy: { name: 'asc' }
    });
    
    let filteredItems = items;
    if (lowStock === 'true') {
      filteredItems = items.filter(item => item.quantity <= item.minimumStock);
    }
    
    res.json(filteredItems);
  } catch (error) {
    console.error('Get uniforms error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== CAFETERIA SUPPLIES ====================

const createCafeteriaSupply = async (req, res) => {
  try {
    const { name, sku, category, unit, currentStock, minimumStock, reorderPoint, unitPrice, supplierId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const supply = await prisma.cafeteriaSupply.create({
      data: {
        name, 
        sku, 
        category, 
        unit, 
        currentStock: currentStock || 0,
        minimumStock: minimumStock || 0, 
        reorderPoint: reorderPoint || 0,
        unitPrice, 
        supplierId, 
        organizationId: organization.id
      },
      include: { supplier: true }
    });
    
    res.status(201).json(supply);
  } catch (error) {
    console.error('Create cafeteria supply error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getCafeteriaSupplies = async (req, res) => {
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
    
    const supplies = await prisma.cafeteriaSupply.findMany({
      where: whereClause,
      include: { supplier: true, consumption: true },
      orderBy: { name: 'asc' }
    });
    
    let filteredSupplies = supplies;
    if (lowStock === 'true') {
      filteredSupplies = supplies.filter(supply => supply.currentStock <= supply.reorderPoint);
    }
    
    res.json(filteredSupplies);
  } catch (error) {
    console.error('Get cafeteria supplies error:', error);
    res.status(500).json({ error: error.message });
  }
};

const recordMealConsumption = async (req, res) => {
  try {
    const { supplyId, quantity, mealType, studentCount, staffCount, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const supply = await prisma.cafeteriaSupply.findUnique({
      where: { id: supplyId }
    });
    
    if (!supply || supply.currentStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const consumption = await prisma.mealConsumption.create({
      data: {
        supplyId, 
        quantity, 
        mealType, 
        studentCount, 
        staffCount, 
        notes,
        organizationId: organization.id
      }
    });
    
    await prisma.cafeteriaSupply.update({
      where: { id: supplyId },
      data: { currentStock: supply.currentStock - quantity }
    });
    
    res.status(201).json(consumption);
  } catch (error) {
    console.error('Record meal consumption error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== HOSTEL SUPPLIES ====================

const createHostelSupply = async (req, res) => {
  try {
    const { name, sku, category, unit, currentStock, minimumStock, reorderPoint, unitPrice, supplierId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const supply = await prisma.hostelSupply.create({
      data: {
        name, 
        sku, 
        category, 
        unit, 
        currentStock: currentStock || 0,
        minimumStock: minimumStock || 0, 
        reorderPoint: reorderPoint || 0,
        unitPrice, 
        supplierId, 
        organizationId: organization.id
      },
      include: { supplier: true }
    });
    
    res.status(201).json(supply);
  } catch (error) {
    console.error('Create hostel supply error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getHostelSupplies = async (req, res) => {
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
    
    const supplies = await prisma.hostelSupply.findMany({
      where: whereClause,
      include: { supplier: true, allocations: true },
      orderBy: { name: 'asc' }
    });
    
    let filteredSupplies = supplies;
    if (lowStock === 'true') {
      filteredSupplies = supplies.filter(supply => supply.currentStock <= supply.reorderPoint);
    }
    
    res.json(filteredSupplies);
  } catch (error) {
    console.error('Get hostel supplies error:', error);
    res.status(500).json({ error: error.message });
  }
};

const allocateToRoom = async (req, res) => {
  try {
    const { supplyId, roomNumber, hostelName, quantity, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const supply = await prisma.hostelSupply.findUnique({
      where: { id: supplyId }
    });
    
    if (!supply || supply.currentStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const allocation = await prisma.roomAllocation.create({
      data: {
        supplyId, 
        roomNumber, 
        hostelName, 
        quantity, 
        notes,
        organizationId: organization.id
      }
    });
    
    await prisma.hostelSupply.update({
      where: { id: supplyId },
      data: { currentStock: supply.currentStock - quantity }
    });
    
    res.status(201).json(allocation);
  } catch (error) {
    console.error('Allocate to room error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== EDUCATION DASHBOARD ====================

const getEducationDashboard = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const totalBooks = await prisma.bookInventory.count({ where: { organizationId: organization.id } });
    const allBooks = await prisma.bookInventory.findMany({ where: { organizationId: organization.id } });
    const lowStockBooks = allBooks.filter(book => book.quantity <= book.minimumStock).length;
    
    const totalStationery = await prisma.stationeryItem.count({ where: { organizationId: organization.id } });
    const allStationery = await prisma.stationeryItem.findMany({ where: { organizationId: organization.id } });
    const lowStockStationery = allStationery.filter(item => item.quantity <= item.minimumStock).length;
    
    const totalUniforms = await prisma.uniformItem.count({ where: { organizationId: organization.id } });
    const allUniforms = await prisma.uniformItem.findMany({ where: { organizationId: organization.id } });
    const lowStockUniforms = allUniforms.filter(item => item.quantity <= item.minimumStock).length;
    
    const totalCafeteria = await prisma.cafeteriaSupply.count({ where: { organizationId: organization.id } });
    const allCafeteria = await prisma.cafeteriaSupply.findMany({ where: { organizationId: organization.id } });
    const lowStockCafeteria = allCafeteria.filter(supply => supply.currentStock <= supply.reorderPoint).length;
    
    const totalHostel = await prisma.hostelSupply.count({ where: { organizationId: organization.id } });
    const allHostel = await prisma.hostelSupply.findMany({ where: { organizationId: organization.id } });
    const lowStockHostel = allHostel.filter(supply => supply.currentStock <= supply.reorderPoint).length;
    
    res.json({
      metrics: {
        books: { total: totalBooks, lowStock: lowStockBooks },
        stationery: { total: totalStationery, lowStock: lowStockStationery },
        uniforms: { total: totalUniforms, lowStock: lowStockUniforms },
        cafeteria: { total: totalCafeteria, lowStock: lowStockCafeteria },
        hostel: { total: totalHostel, lowStock: lowStockHostel }
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createBook,
  getBooks,
  distributeBook,
  returnBook,
  createStationeryItem,
  getStationeryItems,
  createUniformItem,
  getUniformItems,
  createCafeteriaSupply,
  getCafeteriaSupplies,
  recordMealConsumption,
  createHostelSupply,
  getHostelSupplies,
  allocateToRoom,
  getEducationDashboard
};
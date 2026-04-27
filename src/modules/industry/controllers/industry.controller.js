const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all industries (public)
const getAllIndustries = async (req, res) => {
  try {
    const industries = await prisma.industry.findMany({
      select: {
        id: true,
        name: true,
        key: true,
        icon: true,
        color: true
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(industries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get industry by key
const getIndustryByKey = async (req, res) => {
  try {
    const { key } = req.params;
    
    const industry = await prisma.industry.findUnique({
      where: { key },
      select: {
        id: true,
        name: true,
        key: true,
        icon: true,
        color: true,
        modules: {
          select: {
            id: true,
            name: true,
            key: true,
            icon: true,
            color: true,
            isCore: true
          },
          orderBy: { name: 'asc' }
        }
      }
    });
    
    if (!industry) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    
    res.json(industry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get industry modules
const getIndustryModules = async (req, res) => {
  try {
    const { key } = req.params;
    
    const industry = await prisma.industry.findUnique({
      where: { key },
      include: {
        modules: {
          orderBy: { name: 'asc' }
        }
      }
    });
    
    if (!industry) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    
    res.json(industry.modules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllIndustries,
  getIndustryByKey,
  getIndustryModules
};

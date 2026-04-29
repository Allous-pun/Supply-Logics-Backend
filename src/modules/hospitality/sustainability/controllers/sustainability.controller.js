const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// CO2 emission factors (kg CO2 per km)
const EMISSION_FACTORS = {
  truck: { diesel: 0.92, electric: 0.12 },
  van: { diesel: 0.28, petrol: 0.32, electric: 0.08 },
  car: { petrol: 0.21, electric: 0.05, hybrid: 0.12 },
  motorcycle: { petrol: 0.09, electric: 0.03 },
  matatu: { diesel: 0.92, petrol: 0.85 }
};

// ==================== CO2 EMISSIONS ====================

const calculateCO2Emission = async (req, res) => {
  try {
    const { deliveryId, deliveryType, distanceKm, vehicleType, fuelType } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    if (!distanceKm || !vehicleType || !fuelType) {
      return res.status(400).json({ error: 'distanceKm, vehicleType, and fuelType are required' });
    }
    
    const factor = EMISSION_FACTORS[vehicleType]?.[fuelType] || 0.5;
    const co2Emitted = distanceKm * factor;
    
    // Prepare data for saving
    let data = {
      deliveryType: deliveryType || 'manual',
      distanceKm,
      vehicleType,
      fuelType,
      co2Emitted,
      calculationMethod: 'Distance × Emission Factor',
      organizationId: organization.id
    };
    
    let savedEmission = null;
    
    // Try to link to an existing delivery if deliveryId provided
    if (deliveryId && (deliveryType === 'supplier' || deliveryType === 'branch')) {
      if (deliveryType === 'supplier') {
        const deliveryExists = await prisma.supplierDelivery.findUnique({
          where: { id: deliveryId }
        });
        if (deliveryExists) {
          data.supplierDeliveryId = deliveryId;
        }
      } else if (deliveryType === 'branch') {
        const deliveryExists = await prisma.interBranchDelivery.findUnique({
          where: { id: deliveryId }
        });
        if (deliveryExists) {
          data.branchDeliveryId = deliveryId;
        }
      }
    }
    
    // Save the emission record
    savedEmission = await prisma.cO2Emission.create({ data });
    
    const result = {
      id: savedEmission.id,
      deliveryId: deliveryId || savedEmission.id,
      deliveryType: data.deliveryType,
      distanceKm,
      vehicleType,
      fuelType,
      co2Emitted: co2Emitted.toFixed(2),
      kgCO2: `${co2Emitted.toFixed(2)} kg`,
      equivalentTrees: (co2Emitted / 22).toFixed(1),
      recommendation: co2Emitted > 100 ? 'Consider consolidating shipments' : 'Carbon footprint is within acceptable range'
    };
    
    res.status(201).json({
      message: 'CO2 emission calculated and saved',
      emission: result
    });
  } catch (error) {
    console.error('CO2 calculation error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getCO2Emissions = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { startDate, endDate, deliveryType } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    if (deliveryType) {
      whereClause.deliveryType = deliveryType;
    }
    
    const emissions = await prisma.cO2Emission.findMany({
      where: whereClause,
      include: {
        supplierDelivery: {
          include: {
            supplier: true,
            purchaseOrder: true
          }
        },
        branchDelivery: {
          include: {
            fromBranch: true,
            toBranch: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const totalCO2 = emissions.reduce((sum, e) => sum + (e.co2Emitted || 0), 0);
    const totalDistance = emissions.reduce((sum, e) => sum + (e.distanceKm || 0), 0);
    const avgCO2PerKm = totalDistance > 0 ? totalCO2 / totalDistance : 0;
    
    const byVehicleType = {};
    emissions.forEach(e => {
      byVehicleType[e.vehicleType] = (byVehicleType[e.vehicleType] || 0) + e.co2Emitted;
    });
    
    const byMonth = {};
    emissions.forEach(e => {
      const month = e.createdAt.toISOString().slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + e.co2Emitted;
    });
    
    res.json({
      summary: {
        totalEmissions: emissions.length,
        totalCO2: totalCO2.toFixed(2),
        totalDistance: totalDistance.toFixed(0),
        avgCO2PerKm: avgCO2PerKm.toFixed(2),
        equivalentTrees: (totalCO2 / 22).toFixed(0)
      },
      byVehicleType,
      byMonth,
      emissions
    });
  } catch (error) {
    console.error('Get CO2 emissions error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== LOCAL SUPPLIER SCORING ====================

const calculateLocalSupplierScore = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        suppliers: {
          where: { isActive: true }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const results = [];
    
    for (const supplier of organization.suppliers) {
      let distanceKm = 0;
      let isLocal = false;
      let score = 0;
      let region = 'Unknown';
      
      const address = supplier.address?.toLowerCase() || '';
      
      if (address.includes('nairobi')) {
        distanceKm = 10;
        isLocal = true;
        region = 'Nairobi';
        score = 95;
      } else if (address.includes('kiambu') || address.includes('thika')) {
        distanceKm = 30;
        isLocal = true;
        region = 'Kiambu';
        score = 85;
      } else if (address.includes('mombasa')) {
        distanceKm = 480;
        isLocal = false;
        region = 'Mombasa';
        score = 40;
      } else if (address.includes('kisumu')) {
        distanceKm = 350;
        isLocal = false;
        region = 'Kisumu';
        score = 50;
      } else {
        distanceKm = 200;
        isLocal = false;
        region = 'Other';
        score = 30;
      }
      
      score = Math.max(0, Math.min(100, score - (distanceKm / 100) + (supplier.rating / 2)));
      
      const co2SavedPerDelivery = isLocal ? (distanceKm * 0.28 * 2) : 0;
      
      const benefits = {
        economic: isLocal ? 'Supports local economy, reduces transport costs' : 'May offer competitive pricing',
        environmental: isLocal ? `Saves approximately ${co2SavedPerDelivery.toFixed(0)} kg CO2 per delivery` : 'Higher carbon footprint due to transport',
        social: isLocal ? 'Creates local jobs' : 'Expands market reach'
      };
      
      await prisma.localSupplierScore.upsert({
        where: { supplierId: supplier.id },
        update: {
          distanceKm,
          score,
          isLocal,
          region,
          benefits
        },
        create: {
          supplierId: supplier.id,
          distanceKm,
          score,
          isLocal,
          region,
          benefits,
          organizationId: organization.id
        }
      });
      
      results.push({
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        distanceKm,
        score: Math.round(score),
        isLocal,
        region,
        rating: supplier.rating,
        leadTime: supplier.leadTime,
        benefits
      });
    }
    
    results.sort((a, b) => b.score - a.score);
    
    const localSuppliers = results.filter(r => r.isLocal);
    const nonLocalSuppliers = results.filter(r => !r.isLocal);
    
    res.json({
      summary: {
        totalSuppliers: results.length,
        localSuppliers: localSuppliers.length,
        nonLocalSuppliers: nonLocalSuppliers.length,
        averageScore: results.length > 0 ? (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1) : 0,
        potentialCO2Savings: nonLocalSuppliers.reduce((sum, s) => sum + (s.distanceKm * 0.28 * 2), 0).toFixed(0)
      },
      localSuppliers,
      nonLocalSuppliers,
      recommendations: nonLocalSuppliers.map(s => ({
        supplier: s.name,
        currentLocation: s.region,
        distanceKm: s.distanceKm,
        suggestion: `Consider finding a local alternative for ${s.name} to reduce carbon footprint by approximately ${(s.distanceKm * 0.28 * 2).toFixed(0)} kg CO2 per delivery`
      }))
    });
  } catch (error) {
    console.error('Calculate local supplier score error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getLocalSupplierScores = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const scores = await prisma.localSupplierScore.findMany({
      where: { organizationId: organization.id },
      include: {
        supplier: true
      },
      orderBy: { score: 'desc' }
    });
    
    res.json(scores);
  } catch (error) {
    console.error('Get local supplier scores error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== PACKAGING WASTE TRACKING ====================

const recordPackagingWaste = async (req, res) => {
  try {
    const { itemId, quantity, materialType, weightKg, isRecyclable, isReusable } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    if (!itemId || !quantity || !materialType || !weightKg) {
      return res.status(400).json({ error: 'itemId, quantity, materialType, and weightKg are required' });
    }
    
    const waste = await prisma.packagingWaste.create({
      data: {
        itemId,
        quantity,
        materialType,
        weightKg,
        isRecyclable: isRecyclable || false,
        isReusable: isReusable || false,
        organizationId: organization.id
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true
          }
        }
      }
    });
    
    res.status(201).json({
      message: 'Packaging waste recorded',
      waste
    });
  } catch (error) {
    console.error('Record packaging waste error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getPackagingWasteAnalytics = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { startDate, endDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.recordedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const waste = await prisma.packagingWaste.findMany({
      where: {
        organizationId: organization.id,
        ...dateFilter
      },
      include: {
        item: {
          include: {
            category: true
          }
        }
      },
      orderBy: { recordedAt: 'desc' }
    });
    
    const totalWeight = waste.reduce((sum, w) => sum + (w.weightKg || 0), 0);
    const byMaterial = {};
    const recyclableWeight = waste.filter(w => w.isRecyclable).reduce((sum, w) => sum + (w.weightKg || 0), 0);
    const reusableWeight = waste.filter(w => w.isReusable).reduce((sum, w) => sum + (w.weightKg || 0), 0);
    const byCategory = {};
    
    waste.forEach(w => {
      byMaterial[w.materialType] = (byMaterial[w.materialType] || 0) + (w.weightKg || 0);
      const categoryName = w.item?.category?.name || 'Uncategorized';
      byCategory[categoryName] = (byCategory[categoryName] || 0) + (w.weightKg || 0);
    });
    
    res.json({
      summary: {
        totalRecords: waste.length,
        totalWeight: totalWeight.toFixed(2),
        recyclableWeight: recyclableWeight.toFixed(2),
        recyclablePercentage: totalWeight > 0 ? ((recyclableWeight / totalWeight) * 100).toFixed(1) : 0,
        reusableWeight: reusableWeight.toFixed(2),
        reusablePercentage: totalWeight > 0 ? ((reusableWeight / totalWeight) * 100).toFixed(1) : 0,
        environmentalImpact: {
          treesSaved: (recyclableWeight / 20).toFixed(0),
          co2Saved: (recyclableWeight * 2).toFixed(0),
          landfillDiverted: (recyclableWeight + reusableWeight).toFixed(0)
        }
      },
      byMaterial,
      byCategory,
      recentWaste: waste.slice(0, 20).map(w => ({
        id: w.id,
        itemName: w.item?.name,
        materialType: w.materialType,
        weightKg: w.weightKg,
        isRecyclable: w.isRecyclable,
        recordedAt: w.recordedAt
      }))
    });
  } catch (error) {
    console.error('Get packaging waste analytics error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== WASTE REDUCTION SUGGESTIONS ====================

const generateWasteReductionSuggestions = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        packagingWastes: {
          orderBy: { recordedAt: 'desc' },
          take: 100
        },
        wastageRecords: {
          orderBy: { recordedAt: 'desc' },
          take: 100
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const suggestions = [];
    
    const packagingByMaterial = {};
    (organization.packagingWastes || []).forEach(w => {
      packagingByMaterial[w.materialType] = (packagingByMaterial[w.materialType] || 0) + (w.weightKg || 0);
    });
    
    const topMaterial = Object.entries(packagingByMaterial).sort((a, b) => b[1] - a[1])[0];
    if (topMaterial && topMaterial[1] > 10) {
      suggestions.push({
        id: `packaging-${Date.now()}`,
        suggestion: `Switch to reusable ${topMaterial[0]} containers to reduce packaging waste`,
        category: 'packaging',
        estimatedSavings: (topMaterial[1] * 0.5).toFixed(0),
        implementationCost: (topMaterial[1] * 1.2).toFixed(0),
        difficulty: 'medium',
        impact: 'high',
        status: 'PENDING'
      });
    }
    
    const wasteByReason = {};
    (organization.wastageRecords || []).forEach(w => {
      wasteByReason[w.reason] = (wasteByReason[w.reason] || 0) + (w.cost || 0);
    });
    
    const topReason = Object.entries(wasteByReason).sort((a, b) => b[1] - a[1])[0];
    if (topReason) {
      let suggestionText = '';
      if (topReason[0] === 'SPOILAGE') {
        suggestionText = 'Implement FIFO inventory management and improve storage conditions';
      } else if (topReason[0] === 'OVERPRODUCTION') {
        suggestionText = 'Use demand forecasting to optimize production quantities';
      } else if (topReason[0] === 'EXPIRY') {
        suggestionText = 'Set up expiry date tracking and offer discounts on near-expiry items';
      } else if (topReason[0] === 'DAMAGE') {
        suggestionText = 'Review handling procedures and staff training';
      }
      
      if (suggestionText) {
        suggestions.push({
          id: `waste-${Date.now()}`,
          suggestion: suggestionText,
          category: 'food_waste',
          estimatedSavings: (topReason[1] * 0.6).toFixed(0),
          implementationCost: '5000',
          difficulty: 'easy',
          impact: 'high',
          status: 'PENDING'
        });
      }
    }
    
    if (suggestions.length < 2) {
      suggestions.push({
        id: `general-${Date.now()}-1`,
        suggestion: 'Start composting organic waste to reduce landfill impact',
        category: 'waste',
        estimatedSavings: '8000',
        implementationCost: '3000',
        difficulty: 'easy',
        impact: 'medium',
        status: 'PENDING'
      });
      
      suggestions.push({
        id: `general-${Date.now()}-2`,
        suggestion: 'Switch to LED lighting to reduce energy consumption',
        category: 'energy',
        estimatedSavings: '15000',
        implementationCost: '10000',
        difficulty: 'medium',
        impact: 'high',
        status: 'PENDING'
      });
    }
    
    for (const s of suggestions) {
      await prisma.wasteReductionSuggestion.upsert({
        where: { id: s.id },
        update: {
          suggestion: s.suggestion,
          category: s.category,
          estimatedSavings: parseFloat(s.estimatedSavings),
          implementationCost: parseFloat(s.implementationCost),
          difficulty: s.difficulty,
          impact: s.impact,
          status: s.status
        },
        create: {
          id: s.id,
          suggestion: s.suggestion,
          category: s.category,
          estimatedSavings: parseFloat(s.estimatedSavings),
          implementationCost: parseFloat(s.implementationCost),
          difficulty: s.difficulty,
          impact: s.impact,
          organizationId: organization.id
        }
      });
    }
    
    res.json(suggestions);
  } catch (error) {
    console.error('Generate waste reduction suggestions error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getWasteReductionSuggestions = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { status, category } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;
    
    const suggestions = await prisma.wasteReductionSuggestion.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    
    const totalPotentialSavings = suggestions
      .filter(s => s.status === 'PENDING')
      .reduce((sum, s) => sum + (s.estimatedSavings || 0), 0);
    
    const implementedSavings = suggestions
      .filter(s => s.status === 'IMPLEMENTED')
      .reduce((sum, s) => sum + (s.estimatedSavings || 0), 0);
    
    res.json({
      summary: {
        totalSuggestions: suggestions.length,
        pending: suggestions.filter(s => s.status === 'PENDING').length,
        implemented: suggestions.filter(s => s.status === 'IMPLEMENTED').length,
        totalPotentialSavings,
        implementedSavings
      },
      suggestions
    });
  } catch (error) {
    console.error('Get waste reduction suggestions error:', error);
    res.status(500).json({ error: error.message });
  }
};

const implementSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    
    const suggestion = await prisma.wasteReductionSuggestion.update({
      where: { id },
      data: {
        status: 'IMPLEMENTED',
        implementedAt: new Date()
      }
    });
    
    res.json({
      message: 'Suggestion marked as implemented',
      suggestion
    });
  } catch (error) {
    console.error('Implement suggestion error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== SUSTAINABILITY DASHBOARD ====================

const getSustainabilityDashboard = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const co2Emissions = await prisma.cO2Emission.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'desc' }
    });
    
    const co2ThisMonth = await prisma.cO2Emission.aggregate({
      where: {
        organizationId: organization.id,
        createdAt: { gte: thisMonth }
      },
      _sum: { co2Emitted: true }
    });
    
    const co2LastMonth = await prisma.cO2Emission.aggregate({
      where: {
        organizationId: organization.id,
        createdAt: { gte: lastMonth, lt: thisMonth }
      },
      _sum: { co2Emitted: true }
    });
    
    const packagingWastes = await prisma.packagingWaste.findMany({
      where: { organizationId: organization.id },
      orderBy: { recordedAt: 'desc' }
    });
    
    const wasteThisMonth = await prisma.packagingWaste.aggregate({
      where: {
        organizationId: organization.id,
        recordedAt: { gte: thisMonth }
      },
      _sum: { weightKg: true }
    });
    
    const localScores = await prisma.localSupplierScore.findMany({
      where: { organizationId: organization.id },
      include: { supplier: true }
    });
    
    const suggestions = await prisma.wasteReductionSuggestion.findMany({
      where: { organizationId: organization.id }
    });
    
    const totalCO2 = co2Emissions.reduce((sum, e) => sum + (e.co2Emitted || 0), 0);
    const totalPackagingWeight = packagingWastes.reduce((sum, w) => sum + (w.weightKg || 0), 0);
    const recyclableWeight = packagingWastes.filter(w => w.isRecyclable).reduce((sum, w) => sum + (w.weightKg || 0), 0);
    
    const co2Trend = co2LastMonth._sum.co2Emitted 
      ? ((co2ThisMonth._sum.co2Emitted - co2LastMonth._sum.co2Emitted) / co2LastMonth._sum.co2Emitted) * 100 
      : 0;
    
    res.json({
      metrics: {
        totalCO2Emissions: totalCO2.toFixed(2),
        co2ThisMonth: co2ThisMonth._sum.co2Emitted?.toFixed(2) || 0,
        co2Trend: co2Trend.toFixed(1),
        totalPackagingWaste: totalPackagingWeight.toFixed(2),
        recyclablePercentage: totalPackagingWeight > 0 ? ((recyclableWeight / totalPackagingWeight) * 100).toFixed(1) : 0,
        localSuppliersCount: localScores.filter(s => s.isLocal).length,
        totalSuppliers: localScores.length,
        averageLocalScore: localScores.length > 0 ? 
          (localScores.reduce((s, sc) => s + sc.score, 0) / localScores.length).toFixed(1) : 0,
        treesEquivalent: (totalCO2 / 22).toFixed(0),
        suggestionsImplemented: suggestions.filter(s => s.status === 'IMPLEMENTED').length,
        totalSuggestions: suggestions.length
      },
      recommendations: {
        reduceEmissions: co2Emissions.length > 0 && co2Trend > 5 ? 'CO2 emissions increased this month. Consider consolidating deliveries.' : null,
        reducePackaging: totalPackagingWeight > 100 ? 'High packaging waste detected. Consider reusable alternatives.' : null,
        localSourcing: localScores.filter(s => !s.isLocal).length > 2 ? 'Multiple non-local suppliers detected. Opportunity to reduce carbon footprint.' : null
      }
    });
  } catch (error) {
    console.error('Get sustainability dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  calculateCO2Emission,
  getCO2Emissions,
  calculateLocalSupplierScore,
  getLocalSupplierScores,
  recordPackagingWaste,
  getPackagingWasteAnalytics,
  generateWasteReductionSuggestions,
  getWasteReductionSuggestions,
  implementSuggestion,
  getSustainabilityDashboard
};

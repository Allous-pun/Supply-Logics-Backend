const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// CO2 emission factors (kg CO2 per km)
const EMISSION_FACTORS = {
  truck: { diesel: 0.92, electric: 0.12 },
  van: { diesel: 0.28, petrol: 0.32, electric: 0.08 },
  car: { petrol: 0.21, electric: 0.05, hybrid: 0.12 },
  motorcycle: { petrol: 0.09, electric: 0.03 }
};

// ==================== CO2 EMISSIONS ====================

const calculateCO2Emission = async (req, res) => {
  try {
    const { deliveryId, deliveryType, distanceKm, vehicleType, fuelType, poId, fromBranchId, toBranchId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const factor = EMISSION_FACTORS[vehicleType]?.[fuelType] || 0.5;
    const co2Emitted = distanceKm * factor;
    
    // Simple calculation without requiring a delivery ID
    const result = {
      deliveryId: deliveryId || 'manual',
      deliveryType: deliveryType || 'manual',
      distanceKm,
      vehicleType,
      fuelType,
      co2Emitted: co2Emitted.toFixed(2),
      kgCO2: `${co2Emitted.toFixed(2)} kg`,
      equivalentTrees: (co2Emitted / 22).toFixed(1),
      recommendation: co2Emitted > 100 ? 'Consider consolidating shipments' : 'Carbon footprint is within acceptable range'
    };
    
    // Try to save if delivery ID exists and is valid
    if (deliveryId && (deliveryType === 'supplier' || deliveryType === 'branch')) {
      try {
        let data = {
          deliveryType,
          distanceKm,
          vehicleType,
          fuelType,
          co2Emitted,
          calculationMethod: 'Distance × Emission Factor',
          organizationId: organization.id
        };
        
        if (deliveryType === 'supplier') {
          // Check if delivery exists
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
        
        await prisma.cO2Emission.create({ data });
      } catch (dbError) {
        // Non-critical - just log, still return the calculation
        console.log('Could not save CO2 emission to DB:', dbError.message);
      }
    }
    
    res.status(201).json({
      message: 'CO2 emission calculated',
      emission: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCO2Emissions = async (req, res) => {
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
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const emissions = await prisma.cO2Emission.findMany({
      where: {
        organizationId: organization.id,
        ...dateFilter
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const totalCO2 = emissions.reduce((sum, e) => sum + (e.co2Emitted || 0), 0);
    const avgCO2PerDelivery = emissions.length > 0 ? totalCO2 / emissions.length : 0;
    
    res.json({
      summary: {
        totalDeliveries: emissions.length,
        totalCO2: totalCO2.toFixed(2),
        avgCO2PerDelivery: avgCO2PerDelivery.toFixed(2),
        equivalentTrees: (totalCO2 / 22).toFixed(0)
      },
      emissions
    });
  } catch (error) {
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
      
      if (supplier.address?.toLowerCase().includes('nairobi')) {
        distanceKm = 10;
        isLocal = true;
        region = 'Nairobi';
        score = 95;
      } else if (supplier.address?.toLowerCase().includes('kiambu') || supplier.address?.toLowerCase().includes('thika')) {
        distanceKm = 30;
        isLocal = true;
        region = 'Kiambu';
        score = 85;
      } else if (supplier.address?.toLowerCase().includes('mombasa')) {
        distanceKm = 480;
        isLocal = false;
        region = 'Mombasa';
        score = 40;
      } else if (supplier.address?.toLowerCase().includes('kisumu')) {
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
      
      const benefits = {
        economic: isLocal ? 'Supports local economy, reduces transport costs' : 'May offer competitive pricing',
        environmental: isLocal ? `Saves approximately ${(distanceKm * 0.28 * 2).toFixed(0)} kg CO2 per delivery` : 'Higher carbon footprint due to transport',
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
        supplier: supplier.name,
        distanceKm,
        score,
        isLocal,
        region,
        benefits
      });
    }
    
    results.sort((a, b) => b.score - a.score);
    
    res.json({
      localSuppliersCount: results.filter(r => r.isLocal).length,
      averageScore: (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1),
      recommendations: results.filter(r => r.score < 60).map(r => ({
        supplier: r.supplier,
        suggestion: `Consider finding a local alternative for ${r.supplier} to reduce carbon footprint`
      })),
      suppliers: results
    });
  } catch (error) {
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
        item: true
      }
    });
    
    res.status(201).json(waste);
  } catch (error) {
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
    
    waste.forEach(w => {
      byMaterial[w.materialType] = (byMaterial[w.materialType] || 0) + (w.weightKg || 0);
    });
    
    res.json({
      summary: {
        totalRecords: waste.length,
        totalWeight: totalWeight.toFixed(2),
        recyclablePercentage: totalWeight > 0 ? ((recyclableWeight / totalWeight) * 100).toFixed(1) : 0,
        reusablePercentage: totalWeight > 0 ? ((reusableWeight / totalWeight) * 100).toFixed(1) : 0,
        environmentalImpact: {
          treesSaved: (recyclableWeight / 20).toFixed(0),
          co2Saved: (recyclableWeight * 2).toFixed(0)
        }
      },
      byMaterial,
      recentWaste: waste.slice(0, 20)
    });
  } catch (error) {
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
          take: 50
        },
        wastageRecords: {
          orderBy: { recordedAt: 'desc' },
          take: 30
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const suggestions = [];
    
    // Analyze packaging waste
    const packagingByMaterial = {};
    (organization.packagingWastes || []).forEach(w => {
      packagingByMaterial[w.materialType] = (packagingByMaterial[w.materialType] || 0) + (w.weightKg || 0);
    });
    
    const topMaterial = Object.entries(packagingByMaterial).sort((a, b) => b[1] - a[1])[0];
    if (topMaterial && topMaterial[1] > 10) {
      suggestions.push({
        suggestion: `Switch to reusable ${topMaterial[0]} containers to reduce packaging waste`,
        category: 'packaging',
        estimatedSavings: topMaterial[1] * 0.5,
        implementationCost: topMaterial[1] * 1.2,
        difficulty: 'medium',
        impact: 'high'
      });
    }
    
    // Analyze food waste
    const wasteByReason = {};
    (organization.wastageRecords || []).forEach(w => {
      wasteByReason[w.reason] = (wasteByReason[w.reason] || 0) + (w.cost || 0);
    });
    
    const topReason = Object.entries(wasteByReason).sort((a, b) => b[1] - a[1])[0];
    if (topReason) {
      let suggestion = '';
      if (topReason[0] === 'SPOILAGE') {
        suggestion = 'Implement FIFO inventory management and improve storage conditions';
      } else if (topReason[0] === 'OVERPRODUCTION') {
        suggestion = 'Use demand forecasting to optimize production quantities';
      } else if (topReason[0] === 'EXPIRY') {
        suggestion = 'Set up expiry date tracking and offer discounts on near-expiry items';
      } else if (topReason[0] === 'DAMAGE') {
        suggestion = 'Review handling procedures and staff training';
      }
      
      if (suggestion) {
        suggestions.push({
          suggestion,
          category: 'food_waste',
          estimatedSavings: topReason[1] * 0.6,
          implementationCost: 5000,
          difficulty: 'easy',
          impact: 'high'
        });
      }
    }
    
    // Add general suggestions
    if (suggestions.length < 2) {
      suggestions.push({
        suggestion: 'Start composting organic waste to reduce landfill impact',
        category: 'waste',
        estimatedSavings: 8000,
        implementationCost: 3000,
        difficulty: 'easy',
        impact: 'medium'
      });
      
      suggestions.push({
        suggestion: 'Switch to LED lighting to reduce energy consumption',
        category: 'energy',
        estimatedSavings: 15000,
        implementationCost: 10000,
        difficulty: 'medium',
        impact: 'high'
      });
    }
    
    // Save suggestions
    for (const s of suggestions) {
      await prisma.wasteReductionSuggestion.create({
        data: {
          suggestion: s.suggestion,
          category: s.category,
          estimatedSavings: s.estimatedSavings,
          implementationCost: s.implementationCost,
          difficulty: s.difficulty,
          impact: s.impact,
          organizationId: organization.id
        }
      });
    }
    
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWasteReductionSuggestions = async (req, res) => {
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
    
    const suggestions = await prisma.wasteReductionSuggestion.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(suggestions);
  } catch (error) {
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
    
    res.json({ message: 'Suggestion marked as implemented', suggestion });
  } catch (error) {
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
    
    const co2Emissions = await prisma.cO2Emission.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'desc' },
      take: 30
    });
    
    const packagingWastes = await prisma.packagingWaste.findMany({
      where: { organizationId: organization.id },
      orderBy: { recordedAt: 'desc' },
      take: 30
    });
    
    const localScores = await prisma.localSupplierScore.findMany({
      where: { organizationId: organization.id },
      include: { supplier: true }
    });
    
    const totalCO2 = co2Emissions.reduce((sum, e) => sum + (e.co2Emitted || 0), 0);
    const totalPackagingWeight = packagingWastes.reduce((sum, w) => sum + (w.weightKg || 0), 0);
    
    res.json({
      metrics: {
        totalCO2Emissions: totalCO2.toFixed(2),
        co2PerDelivery: co2Emissions.length > 0 ? (totalCO2 / co2Emissions.length).toFixed(2) : 0,
        totalPackagingWaste: totalPackagingWeight.toFixed(2),
        recyclingRate: totalPackagingWeight > 0 ? 
          ((packagingWastes.filter(w => w.isRecyclable).reduce((s, w) => s + (w.weightKg || 0), 0) / totalPackagingWeight) * 100).toFixed(1) : 0,
        localSuppliersCount: localScores.filter(s => s.isLocal).length,
        averageLocalScore: localScores.length > 0 ? 
          (localScores.reduce((s, sc) => s + sc.score, 0) / localScores.length).toFixed(1) : 0
      },
      recommendations: {
        reduceEmissions: co2Emissions.length > 0 ? 'Consider consolidating deliveries to reduce CO2 emissions' : null,
        reducePackaging: totalPackagingWeight > 50 ? 'High packaging waste detected. Consider reusable alternatives.' : null,
        localSourcing: localScores.filter(s => !s.isLocal).length > 0 ? 'Opportunity to source more from local suppliers' : null
      }
    });
  } catch (error) {
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

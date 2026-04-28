const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== PRICE TREND PREDICTION ====================

const predictPriceTrend = async (req, res) => {
  try {
    const { itemId, supplierId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Get price history
    const priceHistory = await prisma.supplierPriceHistory.findMany({
      where: {
        itemId,
        supplierId,
        organizationId: organization.id
      },
      orderBy: { effectiveDate: 'asc' },
      take: 12
    });
    
    if (priceHistory.length < 3) {
      // Simple prediction based on supplier lead time and market
      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      const predictedPrice = item.costPrice * (Math.random() * 0.1 + 0.95); // -5% to +5%
      
      return res.json({
        currentPrice: item.costPrice,
        predictedPrice: predictedPrice.toFixed(2),
        trendDirection: 'STABLE',
        confidence: 30,
        message: 'Insufficient data for accurate prediction'
      });
    }
    
    // Calculate trend using simple linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = priceHistory.length;
    
    priceHistory.forEach((record, i) => {
      const x = i + 1;
      const y = record.newPrice;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const nextX = n + 1;
    const predictedPrice = slope * nextX + intercept;
    const currentPrice = priceHistory[priceHistory.length - 1].newPrice;
    const priceChange = predictedPrice - currentPrice;
    
    let trendDirection = 'STABLE';
    if (priceChange > currentPrice * 0.02) trendDirection = 'UP';
    else if (priceChange < -currentPrice * 0.02) trendDirection = 'DOWN';
    
    // Calculate confidence based on data consistency
    const residuals = priceHistory.map((record, i) => {
      const x = i + 1;
      const actual = record.newPrice;
      const predicted = slope * x + intercept;
      return Math.abs(actual - predicted);
    });
    const avgResidual = residuals.reduce((a, b) => a + b, 0) / n;
    const confidence = Math.max(30, Math.min(90, 100 - (avgResidual / currentPrice) * 100));
    
    // Save prediction
    await prisma.priceTrend.create({
      data: {
        itemId,
        supplierId,
        currentPrice,
        previousPrice: priceHistory[priceHistory.length - 2]?.newPrice || currentPrice,
        priceChange,
        changePercent: (priceChange / currentPrice) * 100,
        trendDirection,
        predictedPrice,
        confidence,
        organizationId: organization.id
      }
    });
    
    res.json({
      itemId,
      supplierId,
      currentPrice,
      predictedPrice: predictedPrice.toFixed(2),
      trendDirection,
      confidence: Math.floor(confidence),
      analysis: {
        slope: slope.toFixed(4),
        dataPoints: n,
        priceChange: priceChange.toFixed(2),
        changePercent: ((priceChange / currentPrice) * 100).toFixed(1)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPriceTrends = async (req, res) => {
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
    if (itemId) whereClause.itemId = itemId;
    
    const trends = await prisma.priceTrend.findMany({
      where: whereClause,
      include: {
        item: true,
        supplier: true
      },
      orderBy: { analysisDate: 'desc' },
      take: 50
    });
    
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DEMAND FORECASTING ====================

const forecastDemand = async (req, res) => {
  try {
    const { itemId, branchId, period } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Get usage history from stock movements (ISSUE type)
    const usageHistory = await prisma.stockMovement.findMany({
      where: {
        itemId,
        type: 'ISSUE',
        organizationId: organization.id,
        ...(branchId && { branchId }),
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (usageHistory.length < 7) {
      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      const avgDailyUsage = item.currentStock / 30 || 10;
      const predictedDemand = avgDailyUsage * (period === 'WEEK' ? 7 : period === 'MONTH' ? 30 : 90);
      
      return res.json({
        itemId,
        predictedDemand: Math.ceil(predictedDemand),
        confidence: 25,
        message: 'Insufficient usage data for accurate forecast',
        basedOn: 'average usage'
      });
    }
    
    // Group by day and calculate daily usage
    const dailyUsage = {};
    usageHistory.forEach(movement => {
      const date = movement.createdAt.toISOString().split('T')[0];
      dailyUsage[date] = (dailyUsage[date] || 0) + movement.quantity;
    });
    
    const dailyValues = Object.values(dailyUsage);
    const avgDailyUsage = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
    const stdDev = Math.sqrt(dailyValues.map(v => Math.pow(v - avgDailyUsage, 2)).reduce((a, b) => a + b, 0) / dailyValues.length);
    
    // Calculate trend (last 30 days vs previous 30 days)
    const last30Days = dailyValues.slice(-30);
    const previous30Days = dailyValues.slice(-60, -30);
    const recentAvg = last30Days.reduce((a, b) => a + b, 0) / last30Days.length;
    const previousAvg = previous30Days.reduce((a, b) => a + b, 0) / previous30Days.length;
    const trendFactor = recentAvg / previousAvg;
    
    let daysInPeriod = period === 'WEEK' ? 7 : period === 'MONTH' ? 30 : 90;
    let predictedDemand = avgDailyUsage * daysInPeriod * Math.max(0.8, Math.min(1.2, trendFactor));
    
    // Add seasonality adjustment for weekends/holidays (simplified)
    const weekendFactor = 1.2; // 20% higher on weekends
    const weekendDays = Math.floor(daysInPeriod * 2 / 7);
    predictedDemand = predictedDemand * (1 + (weekendDays / daysInPeriod) * 0.2);
    
    const lowerBound = predictedDemand - (stdDev * Math.sqrt(daysInPeriod)) * 1.96;
    const upperBound = predictedDemand + (stdDev * Math.sqrt(daysInPeriod)) * 1.96;
    const confidence = Math.min(85, 50 + (usageHistory.length / 30) * 10);
    
    // Save forecast
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + daysInPeriod);
    
    await prisma.demandForecast.create({
      data: {
        itemId,
        branchId: branchId || null,
        forecastPeriod: period,
        forecastDate,
        predictedDemand: Math.ceil(predictedDemand),
        lowerBound: Math.max(0, Math.floor(lowerBound)),
        upperBound: Math.ceil(upperBound),
        confidence,
        factors: JSON.stringify({ avgDailyUsage, trendFactor, weekendFactor }),
        organizationId: organization.id
      }
    });
    
    res.json({
      itemId,
      period,
      predictedDemand: Math.ceil(predictedDemand),
      lowerBound: Math.max(0, Math.floor(lowerBound)),
      upperBound: Math.ceil(upperBound),
      confidence: Math.floor(confidence),
      avgDailyUsage: avgDailyUsage.toFixed(1),
      trendDirection: trendFactor > 1.05 ? 'INCREASING' : trendFactor < 0.95 ? 'DECREASING' : 'STABLE',
      daysOfData: usageHistory.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDemandForecasts = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { itemId, period } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (itemId) whereClause.itemId = itemId;
    if (period) whereClause.forecastPeriod = period;
    
    const forecasts = await prisma.demandForecast.findMany({
      where: whereClause,
      include: {
        item: true,
        branch: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    res.json(forecasts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== STOCKOUT RISK PREDICTION ====================

const predictStockoutRisk = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode },
      include: {
        inventoryItems: {
          include: {
            branchStock: {
              include: {
                branch: true
              }
            },
            movements: {
              where: { type: 'ISSUE' },
              orderBy: { createdAt: 'desc' },
              take: 30
            }
          }
        }
      }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const risks = [];
    
    for (const item of organization.inventoryItems) {
      let avgDailyUsage = 1;
      if (item.movements.length > 0) {
        const totalUsage = item.movements.reduce((sum, m) => sum + m.quantity, 0);
        const daysRange = 30;
        avgDailyUsage = totalUsage / daysRange;
      }
      
      if (avgDailyUsage === 0) avgDailyUsage = 1;
      
      const daysUntilStockout = Math.floor(item.currentStock / avgDailyUsage);
      let riskLevel = 'LOW';
      let riskScore = 0;
      let recommendation = '';
      
      if (daysUntilStockout <= 2) {
        riskLevel = 'CRITICAL';
        riskScore = 90;
        recommendation = 'Place emergency order immediately';
      } else if (daysUntilStockout <= 5) {
        riskLevel = 'HIGH';
        riskScore = 70;
        recommendation = 'Place urgent reorder';
      } else if (daysUntilStockout <= 10) {
        riskLevel = 'MEDIUM';
        riskScore = 50;
        recommendation = 'Review stock levels and consider reorder';
      } else if (daysUntilStockout <= item.reorderPoint / avgDailyUsage) {
        riskLevel = 'MEDIUM';
        riskScore = 40;
        recommendation = 'Monitor stock levels';
      } else {
        riskScore = 20;
        recommendation = 'Stock adequate';
      }
      
      if (daysUntilStockout <= 10) {
        // Check if risk already exists
        const existingRisk = await prisma.stockoutRisk.findFirst({
          where: {
            itemId: item.id,
            branchId: null
          }
        });
        
        let risk;
        if (existingRisk) {
          risk = await prisma.stockoutRisk.update({
            where: { id: existingRisk.id },
            data: {
              riskLevel,
              riskScore,
              currentStock: item.currentStock,
              daysUntilStockout,
              recommendation,
              isResolved: false
            }
          });
        } else {
          risk = await prisma.stockoutRisk.create({
            data: {
              itemId: item.id,
              riskLevel,
              riskScore,
              currentStock: item.currentStock,
              daysUntilStockout,
              reason: `Current stock (${item.currentStock}) will last approximately ${daysUntilStockout} days at current usage rate`,
              recommendation,
              organizationId: organization.id
            }
          });
        }
        
        risks.push({
          item: item.name,
          currentStock: item.currentStock,
          avgDailyUsage: avgDailyUsage.toFixed(1),
          daysUntilStockout,
          riskLevel,
          riskScore,
          recommendation
        });
      }
    }
    
    risks.sort((a, b) => b.riskScore - a.riskScore);
    
    res.json({
      summary: {
        totalItems: organization.inventoryItems.length,
        criticalCount: risks.filter(r => r.riskLevel === 'CRITICAL').length,
        highCount: risks.filter(r => r.riskLevel === 'HIGH').length,
        mediumCount: risks.filter(r => r.riskLevel === 'MEDIUM').length
      },
      risks: risks.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== WASTAGE TRACKING ====================

const recordWastage = async (req, res) => {
  try {
    const { itemId, branchId, quantity, reason, notes } = req.body;
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
    
    const cost = quantity * item.costPrice;
    
    const wastage = await prisma.wastageRecord.create({
      data: {
        itemId,
        branchId: branchId || null,
        quantity,
        cost,
        reason,
        notes,
        recordedBy: userId,
        organizationId: organization.id
      }
    });
    
    // Adjust inventory (deduct wastage)
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: { decrement: quantity } }
    });
    
    // Record as stock movement
    await prisma.stockMovement.create({
      data: {
        itemId,
        branchId: branchId || null,
        quantity: -quantity,
        type: 'WASTAGE',
        reference: `WASTE-${wastage.id.slice(-8)}`,
        previousStock: item.currentStock,
        newStock: item.currentStock - quantity,
        notes: `Wastage: ${reason}. ${notes || ''}`,
        createdBy: userId,
        organizationId: organization.id
      }
    });
    
    res.status(201).json({
      message: 'Wastage recorded successfully',
      wastage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWastageAnalytics = async (req, res) => {
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
    
    const wastageRecords = await prisma.wastageRecord.findMany({
      where: {
        organizationId: organization.id,
        ...dateFilter
      },
      include: {
        item: {
          include: {
            category: true
          }
        },
        branch: true
      },
      orderBy: { recordedAt: 'desc' }
    });
    
    const totalWastageCost = wastageRecords.reduce((sum, w) => sum + w.cost, 0);
    const byReason = {};
    const byCategory = {};
    
    wastageRecords.forEach(w => {
      byReason[w.reason] = (byReason[w.reason] || 0) + w.cost;
      const categoryName = w.item.category?.name || 'Uncategorized';
      byCategory[categoryName] = (byCategory[categoryName] || 0) + w.cost;
    });
    
    res.json({
      summary: {
        totalRecords: wastageRecords.length,
        totalCost: totalWastageCost,
        avgCostPerRecord: wastageRecords.length > 0 ? totalWastageCost / wastageRecords.length : 0
      },
      byReason,
      byCategory,
      recentWastage: wastageRecords.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== CHEAPEST SUPPLIER SUGGESTION ====================

const getCheapestSupplier = async (req, res) => {
  try {
    const { itemId } = req.query;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Get all suppliers that supply this item
    const suppliers = await prisma.supplier.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
        items: {
          some: { id: itemId }
        }
      },
      include: {
        priceHistory: {
          where: { itemId },
          orderBy: { effectiveDate: 'desc' },
          take: 1
        },
        performance: {
          orderBy: { periodStart: 'desc' },
          take: 1
        }
      }
    });
    
    // Get current price from item if no price history
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId }
    });
    
    const suggestions = await Promise.all(suppliers.map(async (supplier) => {
      let currentPrice = supplier.priceHistory[0]?.newPrice;
      if (!currentPrice) {
        // Check purchase orders for last price
        const lastOrder = await prisma.purchaseOrder.findFirst({
          where: {
            supplierId: supplier.id,
            organizationId: organization.id,
            status: 'DELIVERED'
          },
          orderBy: { orderDate: 'desc' }
        });
        
        if (lastOrder) {
          const items = JSON.parse(JSON.stringify(lastOrder.items));
          const foundItem = items.find(i => i.itemId === itemId);
          if (foundItem) currentPrice = foundItem.unitPrice;
        }
      }
      
      if (!currentPrice) currentPrice = item?.costPrice || 0;
      
      const onTimeRate = supplier.performance[0]?.onTimeRate || 0;
      const avgLeadTime = supplier.leadTime || 5;
      
      return {
        supplierId: supplier.id,
        name: supplier.name,
        currentPrice,
        rating: supplier.rating,
        onTimeRate,
        avgLeadTime,
        paymentTerms: supplier.paymentTerms
      };
    }));
    
    suggestions.sort((a, b) => a.currentPrice - b.currentPrice);
    
    // Add savings recommendations
    const cheapest = suggestions[0];
    const recommendations = [];
    
    for (let i = 1; i < suggestions.length; i++) {
      const savingsPerUnit = suggestions[i].currentPrice - cheapest.currentPrice;
      recommendations.push({
        supplier: suggestions[i].name,
        potentialSavingsPerUnit: savingsPerUnit.toFixed(2),
        percentageHigher: ((savingsPerUnit / cheapest.currentPrice) * 100).toFixed(1)
      });
    }
    
    res.json({
      cheapestSupplier: cheapest,
      allSuppliers: suggestions,
      potentialSavings: recommendations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== SPENDING ANOMALY DETECTION ====================

const detectSpendingAnomalies = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Analyze purchase orders from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        organizationId: organization.id,
        orderDate: { gte: ninetyDaysAgo }
      },
      include: {
        supplier: true
      }
    });
    
    // Group by supplier and calculate average spend
    const supplierSpend = {};
    orders.forEach(order => {
      if (!supplierSpend[order.supplierId]) {
        supplierSpend[order.supplierId] = {
          name: order.supplier.name,
          orders: [],
          total: 0
        };
      }
      supplierSpend[order.supplierId].orders.push(order);
      supplierSpend[order.supplierId].total += order.total;
    });
    
    const anomalies = [];
    
    for (const [supplierId, data] of Object.entries(supplierSpend)) {
      if (data.orders.length < 3) continue;
      
      const amounts = data.orders.map(o => o.total);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.map(a => Math.pow(a - avgAmount, 2)).reduce((a, b) => a + b, 0) / amounts.length);
      
      data.orders.forEach(order => {
        const zScore = (order.total - avgAmount) / stdDev;
        if (Math.abs(zScore) > 2) {
          anomalies.push({
            supplier: data.name,
            orderId: order.id,
            orderNumber: order.poNumber,
            orderDate: order.orderDate,
            amount: order.total,
            expectedAmount: avgAmount,
            variance: order.total - avgAmount,
            variancePercent: ((order.total - avgAmount) / avgAmount * 100).toFixed(1),
            severity: Math.abs(zScore) > 3 ? 'HIGH' : 'MEDIUM',
            recommendation: Math.abs(zScore) > 3 ? 'Investigate immediately' : 'Review for possible error'
          });
        }
      });
    }
    
    res.json({
      anomalies: anomalies.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
      totalAnomalies: anomalies.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  // Price Trends
  predictPriceTrend,
  getPriceTrends,
  // Demand Forecasting
  forecastDemand,
  getDemandForecasts,
  // Stockout Risk
  predictStockoutRisk,
  // Wastage
  recordWastage,
  getWastageAnalytics,
  // Supplier Optimization
  getCheapestSupplier,
  // Anomaly Detection
  detectSpendingAnomalies
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== VEHICLES ====================

const createVehicle = async (req, res) => {
  try {
    const { registration, type, model, manufacturer, year, capacity, fuelType, insuranceExpiry, inspectionExpiry, routeId } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Check if vehicle already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registration }
    });
    
    if (existingVehicle) {
      return res.status(400).json({ error: 'Vehicle with this registration already exists' });
    }
    
    const vehicle = await prisma.vehicle.create({
      data: {
        registration, type, model, manufacturer, year, capacity, fuelType,
        status: 'active',
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
        inspectionExpiry: inspectionExpiry ? new Date(inspectionExpiry) : null,
        routeId, 
        organizationId: organization.id
      },
      include: { route: true }
    });
    
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getVehicles = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { type, status } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (type) whereClause.type = type;
    if (status) whereClause.status = status;
    
    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      include: { route: true },
      orderBy: { registration: 'asc' }
    });
    
    res.json(vehicles);
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateVehicleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, currentMileage } = req.body;
    
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: { status, currentMileage }
    });
    
    res.json(vehicle);
  } catch (error) {
    console.error('Update vehicle status error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== ROUTES ====================

const createRoute = async (req, res) => {
  try {
    const { name, code, startPoint, endPoint, distanceKm, estimatedTime, stops, fare, farePerKm } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Check if route with code already exists
    const existingRoute = await prisma.transportRoute.findUnique({
      where: { code }
    });
    
    if (existingRoute) {
      return res.status(400).json({ error: 'Route with this code already exists. Use a different code.' });
    }
    
    const route = await prisma.transportRoute.create({
      data: {
        name, code, startPoint, endPoint, distanceKm, estimatedTime, stops, fare, farePerKm,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(route);
  } catch (error) {
    console.error('Create route error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getRoutes = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const routes = await prisma.transportRoute.findMany({
      where: { organizationId: organization.id },
      include: { vehicles: true, schedules: true },
      orderBy: { name: 'asc' }
    });
    
    res.json(routes);
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== DRIVERS ====================

const createDriver = async (req, res) => {
  try {
    const { name, licenseNumber, licenseClass, phone, email, address, hireDate, salary } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const existingDriver = await prisma.driver.findUnique({
      where: { licenseNumber }
    });
    
    if (existingDriver) {
      return res.status(400).json({ error: 'Driver with this license number already exists' });
    }
    
    const driver = await prisma.driver.create({
      data: {
        name, licenseNumber, licenseClass, phone, email, address,
        hireDate: new Date(hireDate),
        status: 'active',
        salary: salary || 0,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(driver);
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getDrivers = async (req, res) => {
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
    
    const drivers = await prisma.driver.findMany({
      where: whereClause,
      include: { assignments: { include: { vehicle: true, route: true } } },
      orderBy: { name: 'asc' }
    });
    
    res.json(drivers);
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ error: error.message });
  }
};

const assignDriverToVehicle = async (req, res) => {
  try {
    const { driverId, vehicleId, routeId, shift, assignedDate } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // End previous assignment for this driver if exists
    await prisma.driverAssignment.updateMany({
      where: { driverId, status: 'active' },
      data: { status: 'ended', endDate: new Date() }
    });
    
    const assignment = await prisma.driverAssignment.create({
      data: {
        driverId, vehicleId, routeId, shift: shift || 'full',
        assignedDate: assignedDate ? new Date(assignedDate) : new Date(),
        status: 'active',
        organizationId: organization.id
      }
    });
    
    // Update vehicle's assigned driver
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { assignedDriver: driverId }
    });
    
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== TRIPS & REVENUE ====================

const createTrip = async (req, res) => {
  try {
    const { vehicleId, driverId, routeId, conductorName, passengerCount, startTime, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const count = await prisma.trip.count();
    const tripNumber = `TRP-${String(count + 1).padStart(6, '0')}`;
    
    const route = await prisma.transportRoute.findUnique({
      where: { id: routeId }
    });
    
    const trip = await prisma.trip.create({
      data: {
        tripNumber, vehicleId, driverId, routeId, conductorName,
        passengerCount: passengerCount || 0,
        distance: route?.distanceKm || 0,
        startTime: new Date(startTime),
        status: 'in_progress',
        notes,
        organizationId: organization.id
      },
      include: { vehicle: true, driver: true, route: true }
    });
    
    res.status(201).json(trip);
  } catch (error) {
    console.error('Create trip error:', error);
    res.status(500).json({ error: error.message });
  }
};

const completeTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { passengerCount, revenue, endTime } = req.body;
    
    const trip = await prisma.trip.update({
      where: { id },
      data: {
        passengerCount: passengerCount || undefined,
        revenue: revenue || 0,
        endTime: endTime ? new Date(endTime) : new Date(),
        status: 'completed'
      },
      include: { vehicle: true, driver: true }
    });
    
    // Update driver stats
    await prisma.driver.update({
      where: { id: trip.driverId },
      data: { totalTrips: { increment: 1 } }
    });
    
    // Update vehicle odometer
    await prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { currentMileage: { increment: Math.round(trip.distance) } }
    });
    
    res.json(trip);
  } catch (error) {
    console.error('Complete trip error:', error);
    res.status(500).json({ error: error.message });
  }
};

const addTripPayment = async (req, res) => {
  try {
    const { tripId, amount, paymentMethod, transactionRef, collectedBy } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const payment = await prisma.tripPayment.create({
      data: {
        tripId, amount, paymentMethod, transactionRef, collectedBy,
        organizationId: organization.id
      }
    });
    
    await prisma.trip.update({
      where: { id: tripId },
      data: { revenue: { increment: amount } }
    });
    
    res.status(201).json(payment);
  } catch (error) {
    console.error('Add trip payment error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== FUEL TRACKING ====================

const addFuelLog = async (req, res) => {
  try {
    const { vehicleId, driverId, liters, costPerLiter, odometer, station, receiptNumber, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const totalCost = liters * costPerLiter;
    
    const fuelLog = await prisma.fuelLog.create({
      data: {
        vehicleId, driverId, liters, costPerLiter, totalCost, odometer, station, receiptNumber, notes,
        organizationId: organization.id
      }
    });
    
    res.status(201).json(fuelLog);
  } catch (error) {
    console.error('Add fuel log error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getFuelEfficiency = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { vehicleId } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    let whereClause = { organizationId: organization.id };
    if (vehicleId) whereClause.vehicleId = vehicleId;
    
    const fuelLogs = await prisma.fuelLog.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      take: 30
    });
    
    const totalFuel = fuelLogs.reduce((sum, f) => sum + f.liters, 0);
    const totalCost = fuelLogs.reduce((sum, f) => sum + f.totalCost, 0);
    
    res.json({
      summary: {
        totalFuel: totalFuel.toFixed(2),
        totalCost: totalCost.toFixed(2),
        avgCostPerLiter: totalFuel > 0 ? (totalCost / totalFuel).toFixed(2) : 0,
        totalRefuels: fuelLogs.length
      },
      logs: fuelLogs
    });
  } catch (error) {
    console.error('Get fuel efficiency error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MAINTENANCE ====================

const addMaintenance = async (req, res) => {
  try {
    const { vehicleId, maintenanceDate, type, description, cost, odometer, mechanic, nextDueDate, nextDueOdometer, notes } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const maintenance = await prisma.maintenanceRecord.create({
      data: {
        vehicleId, maintenanceDate: new Date(maintenanceDate), type, description, cost, odometer, mechanic,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        nextDueOdometer: nextDueOdometer || null,
        notes,
        organizationId: organization.id
      }
    });
    
    if (type === 'emergency' || type === 'repair') {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { status: 'maintenance' }
      });
    }
    
    res.status(201).json(maintenance);
  } catch (error) {
    console.error('Add maintenance error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== ROUTE OPTIMIZATION ====================

const addTrafficData = async (req, res) => {
  try {
    const { routeId, dayOfWeek, hourOfDay, typicalDuration, congestionLevel, averageSpeed } = req.body;
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const traffic = await prisma.trafficData.upsert({
      where: {
        routeId_dayOfWeek_hourOfDay: {
          routeId,
          dayOfWeek,
          hourOfDay
        }
      },
      update: { typicalDuration, congestionLevel, averageSpeed },
      create: {
        routeId, dayOfWeek, hourOfDay, typicalDuration, congestionLevel, averageSpeed,
        organizationId: organization.id
      }
    });
    
    res.json(traffic);
  } catch (error) {
    console.error('Add traffic data error:', error);
    res.status(500).json({ error: error.message });
  }
};

const optimizeRoute = async (req, res) => {
  try {
    const { routeId, departureTime } = req.body;
    
    const route = await prisma.transportRoute.findUnique({
      where: { id: routeId },
      include: {
        trafficData: true
      }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    const departureHour = new Date(departureTime).getHours();
    const dayOfWeek = new Date(departureTime).getDay() || 7;
    
    const trafficAtTime = route.trafficData.find(t => t.hourOfDay === departureHour && t.dayOfWeek === dayOfWeek);
    
    let estimatedDuration = route.estimatedTime;
    let recommendation = 'Normal traffic expected';
    
    if (trafficAtTime) {
      estimatedDuration = trafficAtTime.typicalDuration;
      if (trafficAtTime.congestionLevel === 'high') {
        recommendation = 'High traffic expected. Suggest leaving 30 minutes earlier';
      } else if (trafficAtTime.congestionLevel === 'severe') {
        recommendation = 'Severe traffic expected. Consider alternative route';
      } else if (trafficAtTime.congestionLevel === 'low') {
        recommendation = 'Light traffic. Good time to travel';
      }
    }
    
    res.json({
      route: route.name,
      distance: route.distanceKm,
      estimatedDuration,
      recommendation,
      trafficLevel: trafficAtTime?.congestionLevel || 'unknown'
    });
  } catch (error) {
    console.error('Optimize route error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== LOGISTICS DASHBOARD ====================

const getLogisticsDashboard = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const totalVehicles = await prisma.vehicle.count({
      where: { organizationId: organization.id }
    });
    
    const activeVehicles = await prisma.vehicle.count({
      where: { organizationId: organization.id, status: 'active' }
    });
    
    const vehiclesInMaintenance = await prisma.vehicle.count({
      where: { organizationId: organization.id, status: 'maintenance' }
    });
    
    const totalDrivers = await prisma.driver.count({
      where: { organizationId: organization.id }
    });
    
    const totalTrips = await prisma.trip.count({
      where: { organizationId: organization.id }
    });
    
    const totalRevenue = await prisma.trip.aggregate({
      where: { organizationId: organization.id },
      _sum: { revenue: true }
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTrips = await prisma.trip.count({
      where: {
        organizationId: organization.id,
        startTime: { gte: today }
      }
    });
    
    const tripsInProgress = await prisma.trip.count({
      where: {
        organizationId: organization.id,
        status: 'in_progress'
      }
    });
    
    res.json({
      metrics: {
        totalVehicles,
        activeVehicles,
        vehiclesInMaintenance,
        totalDrivers,
        totalTrips,
        totalRevenue: totalRevenue._sum.revenue || 0,
        todayTrips,
        tripsInProgress
      }
    });
  } catch (error) {
    console.error('Get logistics dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createVehicle,
  getVehicles,
  updateVehicleStatus,
  createRoute,
  getRoutes,
  createDriver,
  getDrivers,
  assignDriverToVehicle,
  createTrip,
  completeTrip,
  addTripPayment,
  addFuelLog,
  getFuelEfficiency,
  addMaintenance,
  addTrafficData,
  optimizeRoute,
  getLogisticsDashboard
};

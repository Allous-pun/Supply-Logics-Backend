const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Import routes
const organizationRoutes = require('./modules/organization/routes');
const branchRoutes = require('./modules/branch/routes');
const authRoutes = require('./modules/auth/routes');
const userRoutes = require('./modules/users/routes');
const rbacRoutes = require('./modules/rbac/routes');
const industryRoutes = require('./modules/industry/routes');
const settingsRoutes = require('./modules/settings/routes');
const hospitalityRoutes = require('./modules/hospitality/routes');
const healthcareRoutes = require('./modules/healthcare/routes');
const educationRoutes = require('./modules/education/routes');
const retailRoutes = require('./modules/retail/routes');
const manufacturingRoutes = require('./modules/manufacturing/routes');
const logisticsRoutes = require('./modules/logistics/routes');
const reportRoutes = require('./modules/reports/routes');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'BizStack API is running' });
});

// Routes
app.use('/api/industries', industryRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/hospitality', hospitalityRoutes);
app.use('/api/healthcare', healthcareRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/retail', retailRoutes);
app.use('/api/manufacturing', manufacturingRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/reports', reportRoutes);

module.exports = app;

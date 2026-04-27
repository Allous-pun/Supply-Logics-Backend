const ReportService = require('../services/report.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate and upload report to Cloudinary
const generateInventoryReport = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { format = 'excel', startDate, endDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const data = await ReportService.getInventoryReport(organization.id, startDate, endDate);
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'No data found for the selected period' });
    }
    
    let buffer, filename, contentType;
    
    if (format === 'pdf') {
      const metrics = {
        'Total Items': data.length,
        'Low Stock Items': data.filter(i => i.Status === 'Low Stock').length,
        'Total Value': data.reduce((sum, i) => sum + (i['Current Stock'] * i['Cost Price']), 0)
      };
      buffer = await ReportService.generatePDFBuffer(data, 'Inventory Report', metrics);
      filename = `inventory_report_${Date.now()}.pdf`;
      contentType = 'application/pdf';
    } else {
      buffer = await ReportService.generateExcelBuffer(data, 'Inventory Report');
      filename = `inventory_report_${Date.now()}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    // Upload to Cloudinary
    const result = await ReportService.uploadToCloudinary(buffer, filename, contentType);
    
    res.json({
      message: 'Report generated and uploaded to Cloudinary',
      downloadUrl: result.secure_url,
      publicId: result.public_id,
      filename: filename
    });
  } catch (error) {
    console.error('Generate inventory report error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Similar for other reports (same pattern)
const generateProcurementReport = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { format = 'excel', startDate, endDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const data = await ReportService.getProcurementReport(organization.id, startDate, endDate);
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'No procurement data found for the selected period' });
    }
    
    let buffer, filename, contentType;
    
    if (format === 'pdf') {
      const totalSpend = data.reduce((sum, po) => sum + po.Total, 0);
      const metrics = {
        'Total Orders': data.length,
        'Total Spend': totalSpend,
        'Average Order Value': (totalSpend / data.length).toFixed(2),
        'Completed Orders': data.filter(po => po.Status === 'DELIVERED').length,
        'Pending Orders': data.filter(po => po.Status === 'SUBMITTED').length
      };
      buffer = await ReportService.generatePDFBuffer(data, 'Procurement Report', metrics);
      filename = `procurement_report_${Date.now()}.pdf`;
      contentType = 'application/pdf';
    } else {
      buffer = await ReportService.generateExcelBuffer(data, 'Procurement Report');
      filename = `procurement_report_${Date.now()}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    const result = await ReportService.uploadToCloudinary(buffer, filename, contentType);
    
    res.json({
      message: 'Report generated and uploaded to Cloudinary',
      downloadUrl: result.secure_url,
      publicId: result.public_id,
      filename: filename
    });
  } catch (error) {
    console.error('Generate procurement report error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add remaining report functions...
const generateSupplierReport = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { format = 'excel' } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const data = await ReportService.getSupplierReport(organization.id);
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'No suppliers found' });
    }
    
    let buffer, filename, contentType;
    
    if (format === 'pdf') {
      const metrics = {
        'Total Suppliers': data.length,
        'Active Suppliers': data.filter(s => s.Status === 'Active').length,
        'Average Rating': (data.reduce((sum, s) => sum + s.Rating, 0) / data.length).toFixed(1),
        'Average Lead Time': (data.reduce((sum, s) => sum + s['Lead Time'], 0) / data.length).toFixed(0)
      };
      buffer = await ReportService.generatePDFBuffer(data, 'Supplier Report', metrics);
      filename = `supplier_report_${Date.now()}.pdf`;
      contentType = 'application/pdf';
    } else {
      buffer = await ReportService.generateExcelBuffer(data, 'Supplier Report');
      filename = `supplier_report_${Date.now()}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    const result = await ReportService.uploadToCloudinary(buffer, filename, contentType);
    
    res.json({
      message: 'Report generated and uploaded to Cloudinary',
      downloadUrl: result.secure_url,
      publicId: result.public_id,
      filename: filename
    });
  } catch (error) {
    console.error('Generate supplier report error:', error);
    res.status(500).json({ error: error.message });
  }
};

const generateStockMovementReport = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { format = 'excel', startDate, endDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const data = await ReportService.getStockMovementReport(organization.id, startDate, endDate);
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'No stock movements found' });
    }
    
    let buffer, filename, contentType;
    
    if (format === 'pdf') {
      const received = data.filter(m => m.Type === 'RECEIVE').length;
      const issued = data.filter(m => m.Type === 'ISSUE').length;
      const wastage = data.filter(m => m.Type === 'WASTAGE').length;
      const metrics = {
        'Total Movements': data.length,
        'Received Items': received,
        'Issued Items': issued,
        'Wastage': wastage
      };
      buffer = await ReportService.generatePDFBuffer(data, 'Stock Movement Report', metrics);
      filename = `stock_movement_report_${Date.now()}.pdf`;
      contentType = 'application/pdf';
    } else {
      buffer = await ReportService.generateExcelBuffer(data, 'Stock Movement Report');
      filename = `stock_movement_report_${Date.now()}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    const result = await ReportService.uploadToCloudinary(buffer, filename, contentType);
    
    res.json({
      message: 'Report generated and uploaded to Cloudinary',
      downloadUrl: result.secure_url,
      publicId: result.public_id,
      filename: filename
    });
  } catch (error) {
    console.error('Generate stock movement report error:', error);
    res.status(500).json({ error: error.message });
  }
};

const generateWastageReport = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { format = 'excel', startDate, endDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const data = await ReportService.getWastageReport(organization.id, startDate, endDate);
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'No wastage records found' });
    }
    
    let buffer, filename, contentType;
    
    if (format === 'pdf') {
      const totalCost = data.reduce((sum, w) => sum + w.Cost, 0);
      const byReason = {};
      data.forEach(w => { byReason[w.Reason] = (byReason[w.Reason] || 0) + 1; });
      const topReason = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0];
      
      const metrics = {
        'Total Wastage Events': data.length,
        'Total Cost': totalCost,
        'Average Cost per Event': (totalCost / data.length).toFixed(2),
        'Top Wastage Reason': topReason ? `${topReason[0]} (${topReason[1]} events)` : 'N/A'
      };
      buffer = await ReportService.generatePDFBuffer(data, 'Wastage Report', metrics);
      filename = `wastage_report_${Date.now()}.pdf`;
      contentType = 'application/pdf';
    } else {
      buffer = await ReportService.generateExcelBuffer(data, 'Wastage Report');
      filename = `wastage_report_${Date.now()}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    const result = await ReportService.uploadToCloudinary(buffer, filename, contentType);
    
    res.json({
      message: 'Report generated and uploaded to Cloudinary',
      downloadUrl: result.secure_url,
      publicId: result.public_id,
      filename: filename
    });
  } catch (error) {
    console.error('Generate wastage report error:', error);
    res.status(500).json({ error: error.message });
  }
};

const generateFinancialReport = async (req, res) => {
  try {
    const orgCode = req.headers['x-org-code'];
    const { format = 'pdf', startDate, endDate } = req.query;
    
    const organization = await prisma.organization.findUnique({
      where: { orgCode }
    });
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const data = await ReportService.getFinancialReport(organization.id, startDate, endDate);
    
    let buffer, filename, contentType;
    
    if (format === 'pdf') {
      buffer = await ReportService.generatePDFBuffer([], 'Financial Report', data);
      filename = `financial_report_${Date.now()}.pdf`;
      contentType = 'application/pdf';
    } else {
      const summaryData = Object.entries(data).map(([key, value]) => ({ Metric: key, Value: value }));
      buffer = await ReportService.generateExcelBuffer(summaryData, 'Financial Report');
      filename = `financial_report_${Date.now()}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    const result = await ReportService.uploadToCloudinary(buffer, filename, contentType);
    
    res.json({
      message: 'Report generated and uploaded to Cloudinary',
      downloadUrl: result.secure_url,
      publicId: result.public_id,
      filename: filename
    });
  } catch (error) {
    console.error('Generate financial report error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  generateInventoryReport,
  generateProcurementReport,
  generateSupplierReport,
  generateStockMovementReport,
  generateWastageReport,
  generateFinancialReport
};

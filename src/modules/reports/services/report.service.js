const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { cloudinary } = require('../../../utils/cloudinary');
const { Readable } = require('stream');
const prisma = new PrismaClient();

class ReportService {
  // Upload buffer directly to Cloudinary as raw file
  async uploadToCloudinary(buffer, filename, contentType) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'reports',
          public_id: filename.replace(/[^a-zA-Z0-9._-]/g, '_').split('.')[0],
          format: filename.split('.').pop(),
          access_mode: 'public'
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      const bufferStream = Readable.from(buffer);
      bufferStream.pipe(uploadStream);
    });
  }

  // Generate Excel Buffer
  async generateExcelBuffer(data, title) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title.substring(0, 31));

    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = title;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
    worksheet.getCell('A2').font = { size: 10 };

    if (data && data.length > 0) {
      const headers = Object.keys(data[0]);
      
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(4, index + 1);
        cell.value = header.toUpperCase();
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4F46E5' }
        };
      });

      data.forEach((row, rowIndex) => {
        headers.forEach((header, colIndex) => {
          let value = row[header];
          if (value === undefined || value === null) value = '';
          if (typeof value === 'object') value = JSON.stringify(value);
          worksheet.getCell(rowIndex + 5, colIndex + 1).value = value;
        });
      });

      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) maxLength = columnLength;
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    } else {
      worksheet.getCell(4, 1).value = 'No data available';
    }

    return await workbook.xlsx.writeBuffer();
  }

  // Generate PDF Buffer
  async generatePDFBuffer(data, title, metrics = null) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();

        if (metrics && Object.keys(metrics).length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
          doc.moveDown(0.5);
          
          Object.entries(metrics).forEach(([key, value]) => {
            doc.fontSize(10).font('Helvetica').text(`${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`);
          });
          doc.moveDown();
        }

        if (data && data.length > 0) {
          const headers = Object.keys(data[0]);
          let y = doc.y;
          const pageWidth = doc.page.width - 100;
          const colWidth = pageWidth / headers.length;
          
          headers.forEach((header, i) => {
            doc.font('Helvetica-Bold').fontSize(9);
            doc.text(header.toUpperCase(), 50 + (i * colWidth), y, { width: colWidth - 5, align: 'left' });
          });
          
          y += 20;
          
          for (const row of data.slice(0, 100)) {
            if (y > doc.page.height - 50) {
              doc.addPage();
              y = 50;
              headers.forEach((header, i) => {
                doc.font('Helvetica-Bold').fontSize(9);
                doc.text(header.toUpperCase(), 50 + (i * colWidth), y, { width: colWidth - 5, align: 'left' });
              });
              y += 20;
            }
            
            headers.forEach((header, i) => {
              doc.font('Helvetica').fontSize(8);
              let value = row[header];
              if (value === undefined || value === null) value = '-';
              if (typeof value === 'object') value = JSON.stringify(value);
              doc.text(String(value), 50 + (i * colWidth), y, { width: colWidth - 5, align: 'left' });
            });
            y += 15;
          }
        } else {
          doc.fontSize(12).text('No data available for the selected period.', { align: 'center' });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Report data fetchers
  async getInventoryReport(orgId, startDate, endDate) {
    const items = await prisma.inventoryItem.findMany({
      where: { organizationId: orgId },
      include: { category: true, supplier: true }
    });
    
    if (items.length === 0) return [];
    
    return items.map(item => ({
      'Item Name': item.name,
      'SKU': item.sku,
      'Category': item.category?.name || 'Uncategorized',
      'Current Stock': item.currentStock,
      'Unit': item.unit,
      'Min Stock': item.minimumStock,
      'Reorder Point': item.reorderPoint,
      'Cost Price': item.costPrice,
      'Selling Price': item.sellingPrice,
      'Supplier': item.supplier?.name || 'N/A',
      'Status': item.currentStock <= item.reorderPoint ? 'Low Stock' : 'OK'
    }));
  }

  async getProcurementReport(orgId, startDate, endDate) {
    const whereClause = { organizationId: orgId };
    if (startDate && endDate) {
      whereClause.orderDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const orders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: { supplier: true }
    });
    
    if (orders.length === 0) return [];
    
    return orders.map(order => ({
      'PO Number': order.poNumber,
      'Supplier': order.supplier?.name || 'N/A',
      'Order Date': order.orderDate.toISOString().split('T')[0],
      'Expected Date': order.expectedDate.toISOString().split('T')[0],
      'Delivery Date': order.deliveryDate?.toISOString().split('T')[0] || 'Pending',
      'Subtotal': order.subtotal,
      'Tax': order.tax,
      'Total': order.total,
      'Status': order.status
    }));
  }

  async getSupplierReport(orgId) {
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: orgId },
      include: {
        items: true,
        performance: true,
        orderHistory: { take: 10 }
      }
    });
    
    if (suppliers.length === 0) return [];
    
    return suppliers.map(supplier => ({
      'Supplier Name': supplier.name,
      'Code': supplier.code,
      'Contact': supplier.contactPerson || 'N/A',
      'Phone': supplier.phone || 'N/A',
      'Email': supplier.email || 'N/A',
      'Lead Time': supplier.leadTime || 0,
      'Rating': supplier.rating,
      'Total Orders': supplier.orderHistory.length,
      'On-Time Rate': supplier.performance[0]?.onTimeRate || 0,
      'Status': supplier.isActive ? 'Active' : 'Inactive'
    }));
  }

  async getStockMovementReport(orgId, startDate, endDate) {
    const whereClause = { organizationId: orgId };
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: { item: true, branch: true }
    });
    
    if (movements.length === 0) return [];
    
    return movements.map(movement => ({
      'Date': movement.createdAt.toISOString().split('T')[0],
      'Item': movement.item?.name || 'N/A',
      'Type': movement.type,
      'Quantity': movement.quantity,
      'Reference': movement.reference || 'N/A',
      'Previous Stock': movement.previousStock,
      'New Stock': movement.newStock,
      'Branch': movement.branch?.name || 'Main',
      'Notes': movement.notes || 'N/A'
    }));
  }

  async getWastageReport(orgId, startDate, endDate) {
    const whereClause = { organizationId: orgId };
    if (startDate && endDate) {
      whereClause.recordedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const wastage = await prisma.wastageRecord.findMany({
      where: whereClause,
      include: { item: true, branch: true }
    });
    
    if (wastage.length === 0) return [];
    
    return wastage.map(w => ({
      'Date': w.recordedAt.toISOString().split('T')[0],
      'Item': w.item?.name || 'N/A',
      'Quantity': w.quantity,
      'Cost': w.cost,
      'Reason': w.reason,
      'Branch': w.branch?.name || 'Main',
      'Notes': w.notes || 'N/A'
    }));
  }

  async getFinancialReport(orgId, startDate, endDate) {
    const whereClause = { organizationId: orgId };
    if (startDate && endDate) {
      whereClause.orderDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: whereClause
    });
    
    const totalSpend = purchaseOrders.reduce((sum, po) => sum + po.total, 0);
    const totalOrders = purchaseOrders.length;
    
    return {
      'Total Spend (KES)': totalSpend,
      'Total Orders': totalOrders,
      'Average Order Value (KES)': totalOrders > 0 ? (totalSpend / totalOrders).toFixed(2) : 0,
      'Period Start': startDate || 'All time',
      'Period End': endDate || 'All time'
    };
  }
}

module.exports = new ReportService();

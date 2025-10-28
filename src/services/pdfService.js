import PDFDocument from 'pdfkit';
import { logger } from '../utils/logger.js';

/**
 * PDF Service for generating invoices and receipts
 * Uses PDFKit for professional PDF generation with custom styling
 */
class PDFService {
  /**
   * Generate an invoice PDF for an order
   * @param {Object} order - The order object
   * @param {Object} user - The user object
   * @returns {PDFDocument} - The PDF document stream
   */
  generateInvoice(order, user) {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      // Company Information (Header)
      this.addInvoiceHeader(doc);

      // Invoice Details
      this.addInvoiceDetails(doc, order);

      // Customer Information
      this.addCustomerInfo(doc, user, order.shippingAddress);

      // Items Table
      this.addItemsTable(doc, order.items);

      // Order Summary
      this.addOrderSummary(doc, order);

      // Footer
      this.addFooter(doc);

      // Finalize the PDF
      doc.end();

      logger.info(`Generated invoice PDF for order ${order._id}`);
      return doc;
    } catch (error) {
      logger.error('Error generating invoice PDF:', error);
      throw new Error('Failed to generate invoice PDF');
    }
  }

  /**
   * Add invoice header with company information
   */
  addInvoiceHeader(doc) {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('E-COMMERCE STORE', 50, 45)
      .fontSize(10)
      .font('Helvetica')
      .text('123 Business Street', 200, 50, { align: 'right' })
      .text('City, State 12345', 200, 65, { align: 'right' })
      .text('Email: support@store.com', 200, 80, { align: 'right' })
      .text('Phone: (555) 123-4567', 200, 95, { align: 'right' });

    // Horizontal Line
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, 130)
      .lineTo(550, 130)
      .stroke();
  }

  /**
   * Add invoice details (number, date, status)
   */
  addInvoiceDetails(doc, order) {
    const invoiceY = 150;

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text('INVOICE', 50, invoiceY);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Invoice #: ${order.orderNumber || order._id.toString().slice(-8)}`, 50, invoiceY + 25)
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, invoiceY + 40)
      .text(`Status: ${order.status.toUpperCase()}`, 50, invoiceY + 55)
      .text(`Payment: ${order.paymentStatus.toUpperCase()}`, 50, invoiceY + 70);
  }

  /**
   * Add customer information
   */
  addCustomerInfo(doc, user, shippingAddress) {
    const customerY = 150;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text('BILL TO:', 300, customerY);

    doc
      .font('Helvetica')
      .fillColor('#666666')
      .text(`${user.firstName} ${user.lastName}`, 300, customerY + 20)
      .text(user.email, 300, customerY + 35);

    // Shipping Address
    if (shippingAddress) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('SHIP TO:', 300, customerY + 60);

      doc
        .font('Helvetica')
        .fillColor('#666666')
        .text(shippingAddress.street, 300, customerY + 80, { width: 250 })
        .text(
          `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.pincode}`,
          300,
          customerY + 95
        );

      if (shippingAddress.phone) {
        doc.text(`Phone: ${shippingAddress.phone}`, 300, customerY + 110);
      }
    }
  }

  /**
   * Add items table
   */
  addItemsTable(doc, items) {
    const tableTop = 310;
    const tableHeaders = ['Item', 'Quantity', 'Price', 'Total'];
    const columnWidths = [250, 80, 80, 80];
    const startX = 50;

    // Table Header
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .rect(startX, tableTop, 490, 25)
      .fill('#333333');

    let currentX = startX + 10;
    tableHeaders.forEach((header, i) => {
      doc
        .fillColor('#ffffff')
        .text(header, currentX, tableTop + 8, {
          width: columnWidths[i],
          align: i === 0 ? 'left' : 'right',
        });
      currentX += columnWidths[i];
    });

    // Table Rows
    let currentY = tableTop + 30;
    doc.fillColor('#333333').font('Helvetica');

    items.forEach((item, index) => {
      const itemName = item.name || item.product?.name || 'Product';
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const total = quantity * price;

      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(startX, currentY - 5, 490, 20).fill('#f5f5f5');
      }

      doc.fillColor('#333333');

      // Item name (truncate if too long)
      const truncatedName = itemName.length > 35 ? itemName.substring(0, 32) + '...' : itemName;
      doc.text(truncatedName, startX + 10, currentY, { width: columnWidths[0] });

      // Quantity
      doc.text(quantity.toString(), startX + columnWidths[0] + 10, currentY, {
        width: columnWidths[1],
        align: 'right',
      });

      // Price
      doc.text(`$${price.toFixed(2)}`, startX + columnWidths[0] + columnWidths[1] + 10, currentY, {
        width: columnWidths[2],
        align: 'right',
      });

      // Total
      doc.text(
        `$${total.toFixed(2)}`,
        startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + 10,
        currentY,
        {
          width: columnWidths[3],
          align: 'right',
        }
      );

      currentY += 25;
    });

    return currentY;
  }

  /**
   * Add order summary with totals
   */
  addOrderSummary(doc, order) {
    const summaryX = 350;
    const summaryStartY = 550;

    // Horizontal line before summary
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(summaryX - 20, summaryStartY - 20)
      .lineTo(550, summaryStartY - 20)
      .stroke();

    doc.fontSize(10).fillColor('#666666');

    // Subtotal
    const subtotal = order.subtotal || order.total || 0;
    doc
      .text('Subtotal:', summaryX, summaryStartY)
      .text(`$${subtotal.toFixed(2)}`, summaryX + 120, summaryStartY, { align: 'right' });

    // Discount (if any)
    if (order.discountAmount && order.discountAmount > 0) {
      doc
        .text('Discount:', summaryX, summaryStartY + 20)
        .fillColor('#22c55e')
        .text(`-$${order.discountAmount.toFixed(2)}`, summaryX + 120, summaryStartY + 20, {
          align: 'right',
        })
        .fillColor('#666666');
    }

    // Shipping
    const shipping = order.shippingCost || 0;
    doc
      .text('Shipping:', summaryX, summaryStartY + 40)
      .text(`$${shipping.toFixed(2)}`, summaryX + 120, summaryStartY + 40, { align: 'right' });

    // Tax (if any)
    if (order.tax && order.tax > 0) {
      doc
        .text('Tax:', summaryX, summaryStartY + 60)
        .text(`$${order.tax.toFixed(2)}`, summaryX + 120, summaryStartY + 60, { align: 'right' });
    }

    // Total
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text('Total:', summaryX, summaryStartY + 90)
      .text(`$${order.total.toFixed(2)}`, summaryX + 120, summaryStartY + 90, { align: 'right' });
  }

  /**
   * Add footer with thank you message and policies
   */
  addFooter(doc) {
    const footerY = 700;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text('Thank you for your business!', 50, footerY, { align: 'center', width: 500 });

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        'For questions about this invoice, please contact support@store.com',
        50,
        footerY + 20,
        { align: 'center', width: 500 }
      );

    doc
      .text('This is a computer-generated invoice and does not require a signature.', 50, footerY + 35, {
        align: 'center',
        width: 500,
      });

    // Page number
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#888888')
        .text(`Page ${i + 1} of ${pages.count}`, 50, 750, { align: 'center', width: 500 });
    }
  }

  /**
   * Generate a receipt PDF (simpler than invoice)
   * @param {Object} order - The order object
   * @param {Object} user - The user object
   * @returns {PDFDocument} - The PDF document stream
   */
  generateReceipt(order, user) {
    try {
      const doc = new PDFDocument({ size: [300, 600], margin: 20 });

      // Receipt Header
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('RECEIPT', { align: 'center' })
        .fontSize(10)
        .font('Helvetica')
        .text('E-Commerce Store', { align: 'center' })
        .fontSize(8)
        .text(new Date().toLocaleString(), { align: 'center' })
        .moveDown();

      // Order Info
      doc
        .fontSize(8)
        .text(`Order #: ${order.orderNumber || order._id.toString().slice(-8)}`)
        .text(`Customer: ${user.firstName} ${user.lastName}`)
        .moveDown();

      // Items
      doc.fontSize(8).font('Helvetica-Bold').text('Items:', { underline: true });

      order.items.forEach((item) => {
        const itemName = item.name || item.product?.name || 'Product';
        const quantity = item.quantity || 1;
        const price = item.price || 0;
        const total = quantity * price;

        doc
          .font('Helvetica')
          .text(`${quantity}x ${itemName}`)
          .text(`$${price.toFixed(2)} ea. = $${total.toFixed(2)}`, { align: 'right' });
      });

      doc.moveDown();

      // Total
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`Total: $${order.total.toFixed(2)}`, { align: 'right' });

      doc.moveDown();
      doc.fontSize(8).font('Helvetica').text('Thank you!', { align: 'center' });

      doc.end();

      logger.info(`Generated receipt PDF for order ${order._id}`);
      return doc;
    } catch (error) {
      logger.error('Error generating receipt PDF:', error);
      throw new Error('Failed to generate receipt PDF');
    }
  }
}

export const pdfService = new PDFService();
export default pdfService;

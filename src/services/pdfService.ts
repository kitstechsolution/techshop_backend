import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { logger } from '../utils/logger.js';

interface InvoiceItem {
  product: string;
  quantity: number;
  price: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  date: Date;
  customer: {
    name: string;
    email: string;
  };
  shippingAddress: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
}

class PDFService {
  /**
   * Generate an invoice PDF and stream it to the response
   */
  async generateInvoice(res: Response, invoiceData: InvoiceData): Promise<void> {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Invoice - ${invoiceData.invoiceNumber}`,
          Author: 'E-Commerce Store',
          Subject: 'Invoice',
        },
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${invoiceData.orderNumber}.pdf"`
      );

      // Pipe the PDF to the response
      doc.pipe(res);

      // Build the PDF content
      this.buildInvoiceHeader(doc, invoiceData);
      this.buildCustomerInfo(doc, invoiceData);
      this.buildInvoiceTable(doc, invoiceData);
      this.buildInvoiceFooter(doc, invoiceData);

      // Finalize the PDF
      doc.end();

      logger.info(`Generated invoice PDF for order ${invoiceData.orderNumber}`);
    } catch (error) {
      logger.error('Error generating PDF invoice:', error);
      throw error;
    }
  }

  /**
   * Build invoice header with logo and company info
   */
  private buildInvoiceHeader(doc: PDFKit.PDFDocument, invoiceData: InvoiceData): void {
    // Company name and logo placeholder
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('E-COMMERCE STORE', 50, 50);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Electronics & Robotics', 50, 75)
      .text('support@ecommerce.com', 50, 90)
      .text('www.ecommerce.com', 50, 105);

    // Invoice title and number
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('INVOICE', 400, 50, { align: 'right' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice #: ${invoiceData.invoiceNumber}`, 400, 75, { align: 'right' })
      .text(`Order #: ${invoiceData.orderNumber}`, 400, 90, { align: 'right' })
      .text(`Date: ${new Date(invoiceData.date).toLocaleDateString()}`, 400, 105, { align: 'right' });

    // Draw a line
    doc
      .moveTo(50, 140)
      .lineTo(550, 140)
      .stroke();
  }

  /**
   * Build customer and shipping information section
   */
  private buildCustomerInfo(doc: PDFKit.PDFDocument, invoiceData: InvoiceData): void {
    const startY = 160;

    // Bill To
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('BILL TO:', 50, startY);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(invoiceData.customer.name, 50, startY + 20)
      .text(invoiceData.customer.email, 50, startY + 35);

    // Ship To
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('SHIP TO:', 300, startY);

    const address = invoiceData.shippingAddress;
    let shipToY = startY + 20;

    if (address.street) {
      doc.fontSize(10).font('Helvetica').text(address.street, 300, shipToY);
      shipToY += 15;
    }

    const cityLine = [
      address.city,
      address.state,
      address.zipCode
    ].filter(Boolean).join(', ');

    if (cityLine) {
      doc.text(cityLine, 300, shipToY);
      shipToY += 15;
    }

    if (address.country) {
      doc.text(address.country, 300, shipToY);
    }
  }

  /**
   * Build the items table
   */
  private buildInvoiceTable(doc: PDFKit.PDFDocument, invoiceData: InvoiceData): void {
    const tableTop = 280;
    const itemX = 50;
    const quantityX = 300;
    const priceX = 380;
    const totalX = 480;

    // Table header
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('ITEM', itemX, tableTop)
      .text('QTY', quantityX, tableTop)
      .text('PRICE', priceX, tableTop)
      .text('TOTAL', totalX, tableTop);

    // Draw header line
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Table items
    let currentY = tableTop + 25;
    doc.fontSize(10).font('Helvetica');

    invoiceData.items.forEach((item) => {
      // Check if we need a new page
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc
        .text(this.truncateText(item.product, 35), itemX, currentY)
        .text(item.quantity.toString(), quantityX, currentY)
        .text(`$${item.price.toFixed(2)}`, priceX, currentY)
        .text(`$${item.total.toFixed(2)}`, totalX, currentY);

      currentY += 25;
    });

    // Draw line before totals
    doc
      .moveTo(50, currentY)
      .lineTo(550, currentY)
      .stroke();

    currentY += 15;

    // Subtotal
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Subtotal:', priceX - 30, currentY)
      .text(`$${invoiceData.subtotal.toFixed(2)}`, totalX, currentY);

    currentY += 20;

    // Tax
    doc
      .text('Tax:', priceX - 30, currentY)
      .text(`$${invoiceData.tax.toFixed(2)}`, totalX, currentY);

    currentY += 20;

    // Shipping
    doc
      .text('Shipping:', priceX - 30, currentY)
      .text(`$${invoiceData.shipping.toFixed(2)}`, totalX, currentY);

    currentY += 25;

    // Draw line before grand total
    doc
      .moveTo(380, currentY - 5)
      .lineTo(550, currentY - 5)
      .stroke();

    // Grand Total
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('TOTAL:', priceX - 30, currentY)
      .text(`$${invoiceData.total.toFixed(2)}`, totalX, currentY);

    // Payment info
    if (invoiceData.paymentMethod || invoiceData.paymentStatus) {
      currentY += 40;
      doc.fontSize(10).font('Helvetica-Bold').text('Payment Information:', 50, currentY);

      currentY += 15;
      doc.fontSize(9).font('Helvetica');

      if (invoiceData.paymentMethod) {
        doc.text(`Method: ${invoiceData.paymentMethod}`, 50, currentY);
        currentY += 15;
      }

      if (invoiceData.paymentStatus) {
        doc.text(`Status: ${invoiceData.paymentStatus}`, 50, currentY);
      }
    }
  }

  /**
   * Build invoice footer with terms and thank you message
   */
  private buildInvoiceFooter(doc: PDFKit.PDFDocument, _invoiceData: InvoiceData): void {
    const footerTop = 720;

    // Draw line before footer
    doc
      .moveTo(50, footerTop)
      .lineTo(550, footerTop)
      .stroke();

    // Thank you message
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Thank you for your business!', 50, footerTop + 20, {
        align: 'center',
        width: 500,
      });

    // Terms and conditions
    doc
      .fontSize(8)
      .font('Helvetica')
      .text('Terms & Conditions: Payment is due within 30 days.', 50, footerTop + 45, {
        align: 'center',
        width: 500,
      })
      .text('For support, contact: support@ecommerce.com', 50, footerTop + 60, {
        align: 'center',
        width: 500,
      });
  }

  /**
   * Truncate text to a specific length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate a simple receipt PDF (alternative to full invoice)
   */
  async generateReceipt(res: Response, invoiceData: InvoiceData): Promise<void> {
    try {
      const doc = new PDFDocument({
        size: [300, 600], // Receipt size
        margin: 20,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="receipt-${invoiceData.orderNumber}.pdf"`
      );

      doc.pipe(res);

      // Receipt header
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('E-Commerce Store', { align: 'center' });

      doc
        .fontSize(8)
        .font('Helvetica')
        .text('RECEIPT', { align: 'center' })
        .moveDown();

      // Order info
      doc
        .fontSize(9)
        .text(`Order: ${invoiceData.orderNumber}`)
        .text(`Date: ${new Date(invoiceData.date).toLocaleDateString()}`)
        .text(`Customer: ${invoiceData.customer.name}`)
        .moveDown();

      // Items
      doc.fontSize(9).font('Helvetica-Bold').text('Items:');
      doc.font('Helvetica');

      invoiceData.items.forEach((item) => {
        doc
          .fontSize(8)
          .text(`${item.product}`)
          .text(`  ${item.quantity} x $${item.price.toFixed(2)} = $${item.total.toFixed(2)}`);
      });

      doc.moveDown();

      // Totals
      doc
        .fontSize(9)
        .text(`Subtotal: $${invoiceData.subtotal.toFixed(2)}`)
        .text(`Tax: $${invoiceData.tax.toFixed(2)}`)
        .text(`Shipping: $${invoiceData.shipping.toFixed(2)}`)
        .moveDown();

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`TOTAL: $${invoiceData.total.toFixed(2)}`)
        .moveDown();

      doc
        .fontSize(8)
        .font('Helvetica')
        .text('Thank you for your purchase!', { align: 'center' });

      doc.end();

      logger.info(`Generated receipt PDF for order ${invoiceData.orderNumber}`);
    } catch (error) {
      logger.error('Error generating PDF receipt:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pdfService = new PDFService();

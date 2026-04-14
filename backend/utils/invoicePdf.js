const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COMPANY = {
  legalName: process.env.BUSINESS_LEGAL_NAME || 'Naturanza Wellness Pvt. Ltd.',
  website: process.env.BUSINESS_WEBSITE || 'www.naturanzafoods.com',
  email: process.env.BUSINESS_SUPPORT_EMAIL || 'support@naturanzafoods.com',
  phone: process.env.BUSINESS_SUPPORT_PHONE || '+92 42 3890 1144',
  officeAddress:
    process.env.BUSINESS_OFFICE_ADDRESS ||
    'Office 204, Cedar Tower, MM Alam Road, Gulberg III, Lahore 54660, Pakistan',
};

const PAYMENT_METHOD_LABELS = {
  cod: 'Cash on Delivery',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  card: 'Card',
  online: 'Online Payment',
};

const PRIMARY_GREEN = '#166534';
const SOFT_GREEN = '#dcfce7';
const DARK_TEXT = '#0f172a';
const MUTED_TEXT = '#475569';
const BORDER = '#e2e8f0';
const DISCOUNT_RED = '#b91c1c';

const safeNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeText = (value, fallback = '-') => {
  const next = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return next || fallback;
};

const formatMoney = (value, currency = 'PKR') =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value, 0));

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-PK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

let cachedLogoPath;

const resolveLogoPath = () => {
  if (cachedLogoPath !== undefined) {
    return cachedLogoPath;
  }

  const candidates = [
    path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'logo.png'),
    path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'f_logo.png'),
    path.join(__dirname, '..', '..', 'public', 'images', 'logo.png'),
  ];

  cachedLogoPath = candidates.find((candidate) => fs.existsSync(candidate)) || null;
  return cachedLogoPath;
};

const getPaymentMethodLabel = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  return PAYMENT_METHOD_LABELS[normalized] || normalizeText(value, 'N/A');
};

const getStatusLabel = (value) => {
  const normalized = String(value || 'pending')
    .trim()
    .toLowerCase();

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const drawRoundedRect = (doc, x, y, w, h, r = 8) => {
  doc.roundedRect(x, y, w, h, r).stroke(BORDER);
};

const drawItemsTableHeader = (doc, y, columns) => {
  doc
    .save()
    .rect(columns.startX, y, columns.totalWidth, 24)
    .fill(PRIMARY_GREEN)
    .restore();

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#ffffff')
    .text('#', columns.indexX + 6, y + 7)
    .text('Product Name', columns.productX + 6, y + 7)
    .text('Qty', columns.qtyX + 6, y + 7)
    .text('Unit Price', columns.unitX + 6, y + 7)
    .text('Amount', columns.amountX + 6, y + 7);
};

const createInvoicePdfBuffer = async (order, options = {}) => {
  const currency = options.currency || 'PKR';

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 34,
        info: {
          Title: `Invoice ORD-${String(order.id || '').padStart(6, '0')}`,
          Author: COMPANY.legalName,
          Subject: 'Order Invoice',
          CreationDate: new Date(),
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 34;
      const contentWidth = pageWidth - margin * 2;

      const orderNumber = `ORD-${String(order.id || '').padStart(6, '0')}`;
      const invoiceDate = formatDateTime(order.order_date || order.created_at);
      const statusText = getStatusLabel(order.status);
      const paymentMethodText = getPaymentMethodLabel(order.payment_method);
      const logoPath = resolveLogoPath();

      doc
        .save()
        .fillColor('#f0fdf4')
        .circle(pageWidth - 20, 30, 120)
        .fill()
        .restore();
      doc
        .save()
        .fillColor('#f7fee7')
        .circle(0, pageHeight - 80, 90)
        .fill()
        .restore();

      if (logoPath) {
        try {
          doc.image(logoPath, margin, margin - 4, {
            fit: [64, 64],
            align: 'left',
            valign: 'top',
          });
        } catch (_) {
          // Ignore logo errors so invoice generation never fails.
        }
      }

      const companyTextX = logoPath ? margin + 72 : margin;
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor(DARK_TEXT)
        .text(COMPANY.legalName, companyTextX, margin + 2, {
          width: 250,
        });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED_TEXT)
        .text(COMPANY.website, companyTextX, margin + 22);

      const rightWidth = 230;
      const rightX = pageWidth - margin - rightWidth;

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(PRIMARY_GREEN)
        .text('Naturanza Invoice', rightX, margin + 2, {
          width: rightWidth,
          align: 'right',
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(15)
        .fillColor(DARK_TEXT)
        .text(orderNumber, rightX, margin + 24, {
          width: rightWidth,
          align: 'right',
        });

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED_TEXT)
        .text(`Invoice Date: ${invoiceDate}`, rightX, margin + 44, {
          width: rightWidth,
          align: 'right',
        })
        .text(`Payment Method: ${paymentMethodText}`, rightX, margin + 58, {
          width: rightWidth,
          align: 'right',
        });

      const badgeWidth = 92;
      const badgeHeight = 20;
      const badgeX = pageWidth - margin - badgeWidth;
      const badgeY = margin + 73;

      doc
        .save()
        .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 10)
        .fill(SOFT_GREEN)
        .restore();
      doc
        .save()
        .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 10)
        .stroke('#86efac')
        .restore();
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(PRIMARY_GREEN)
        .text(statusText, badgeX, badgeY + 6, {
          width: badgeWidth,
          align: 'center',
        });

      let y = margin + 106;
      doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke(BORDER);

      y += 14;
      const cardGap = 10;
      const cardWidth = (contentWidth - cardGap) / 2;
      const cardHeight = 110;

      drawRoundedRect(doc, margin, y, cardWidth, cardHeight);
      drawRoundedRect(doc, margin + cardWidth + cardGap, y, cardWidth, cardHeight);

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(PRIMARY_GREEN)
        .text('Bill To', margin + 10, y + 10)
        .text('From', margin + cardWidth + cardGap + 10, y + 10);

      const billToName = normalizeText(order.customer_name || order.user_name, 'Customer');
      const billToEmail = normalizeText(order.customer_email, '-');
      const billToAddress = normalizeText(order.shipping_address, 'Address not available');

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(DARK_TEXT)
        .text(billToName, margin + 10, y + 28, { width: cardWidth - 20 })
        .text(billToEmail, margin + 10, y + 42, { width: cardWidth - 20 })
        .text(billToAddress, margin + 10, y + 56, {
          width: cardWidth - 20,
          height: 44,
        });

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(DARK_TEXT)
        .text(COMPANY.legalName, margin + cardWidth + cardGap + 10, y + 28, {
          width: cardWidth - 20,
        })
        .text(COMPANY.email, margin + cardWidth + cardGap + 10, y + 42, {
          width: cardWidth - 20,
        })
        .text(COMPANY.phone, margin + cardWidth + cardGap + 10, y + 56, {
          width: cardWidth - 20,
        })
        .text(COMPANY.officeAddress, margin + cardWidth + cardGap + 10, y + 70, {
          width: cardWidth - 20,
          height: 34,
        });

      y += cardHeight + 16;

      const columns = {
        startX: margin,
        totalWidth: contentWidth,
        indexX: margin,
        productX: margin + 34,
        qtyX: margin + 334,
        unitX: margin + 394,
        amountX: margin + 484,
      };

      drawItemsTableHeader(doc, y, columns);
      y += 24;

      const items = Array.isArray(order.items) ? order.items : [];
      const rows = items.length
        ? items
        : [{
            _placeholder: true,
            product_name: 'No items available',
            quantity: '-',
            price: 0,
          }];

      rows.forEach((item, index) => {
        const rowHeight = 26;

        if (y + rowHeight > pageHeight - 170) {
          doc.addPage();
          y = margin;
          drawItemsTableHeader(doc, y, columns);
          y += 24;
        }

        doc
          .save()
          .rect(columns.startX, y, columns.totalWidth, rowHeight)
          .stroke(BORDER)
          .restore();

        doc
          .save()
          .moveTo(columns.productX, y)
          .lineTo(columns.productX, y + rowHeight)
          .moveTo(columns.qtyX, y)
          .lineTo(columns.qtyX, y + rowHeight)
          .moveTo(columns.unitX, y)
          .lineTo(columns.unitX, y + rowHeight)
          .moveTo(columns.amountX, y)
          .lineTo(columns.amountX, y + rowHeight)
          .stroke(BORDER)
          .restore();

        const quantity = item._placeholder ? '-' : String(safeNumber(item.quantity, 1));
        const unitPrice = safeNumber(item.price, 0);
        const amount = safeNumber(item.quantity, 1) * unitPrice;

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(DARK_TEXT)
          .text(item._placeholder ? '-' : String(index + 1), columns.indexX + 8, y + 8)
          .text(normalizeText(item.product_name || item.name, 'Product'), columns.productX + 8, y + 8, {
            width: columns.qtyX - columns.productX - 12,
            ellipsis: true,
          })
          .text(quantity, columns.qtyX, y + 8, {
            width: columns.unitX - columns.qtyX,
            align: 'center',
          })
          .text(item._placeholder ? '-' : formatMoney(unitPrice, currency), columns.unitX + 4, y + 8, {
            width: columns.amountX - columns.unitX - 8,
            align: 'right',
          })
          .text(item._placeholder ? '-' : formatMoney(amount, currency), columns.amountX + 4, y + 8, {
            width: columns.startX + columns.totalWidth - columns.amountX - 8,
            align: 'right',
          });

        y += rowHeight;
      });

      y += 16;
      if (y + 120 > pageHeight - 100) {
        doc.addPage();
        y = margin + 20;
      }

      const totalsX = pageWidth - margin - 230;
      const totalValueX = pageWidth - margin;

      const subtotal = safeNumber(order.subtotal, 0);
      const tax = safeNumber(order.tax, 0);
      const shipping = safeNumber(order.shipping_cost, 0);
      const discount = safeNumber(order.discount_amount, 0);
      const grandTotal = safeNumber(order.total_amount, 0);

      const drawTotalRow = (label, value, config = {}) => {
        doc
          .font(config.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(config.size || 10)
          .fillColor(config.color || MUTED_TEXT)
          .text(label, totalsX, y, {
            width: 110,
            align: 'left',
          })
          .text(value, totalValueX - 120, y, {
            width: 120,
            align: 'right',
          });

        y += config.step || 16;
      };

      drawTotalRow('Subtotal', formatMoney(subtotal, currency), { color: MUTED_TEXT });
      drawTotalRow('Tax', formatMoney(tax, currency), { color: MUTED_TEXT });
      drawTotalRow(
        'Shipping',
        shipping === 0 ? 'Free' : formatMoney(shipping, currency),
        { color: MUTED_TEXT },
      );
      drawTotalRow(
        'Discount',
        discount > 0 ? `-${formatMoney(discount, currency)}` : formatMoney(0, currency),
        { color: discount > 0 ? DISCOUNT_RED : MUTED_TEXT },
      );

      doc.moveTo(totalsX, y - 6).lineTo(totalValueX, y - 6).stroke(BORDER);

      drawTotalRow('Grand Total', formatMoney(grandTotal, currency), {
        bold: true,
        size: 13,
        color: PRIMARY_GREEN,
        step: 18,
      });

      const footerY = pageHeight - 72;
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(PRIMARY_GREEN)
        .text('Thank you for choosing Naturanza! Your wellness journey matters to us.', margin, footerY, {
          width: contentWidth,
          align: 'center',
        });

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED_TEXT)
        .text('7 days easy return for unopened products.', margin, footerY + 14, {
          width: contentWidth,
          align: 'center',
        })
        .text(`${COMPANY.email} | ${COMPANY.phone}`, margin, footerY + 27, {
          width: contentWidth,
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  createInvoicePdfBuffer,
};

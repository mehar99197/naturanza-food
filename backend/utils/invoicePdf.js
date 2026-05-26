const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COMPANY = {
  legalName: process.env.BUSINESS_LEGAL_NAME || 'Naturanza Wellness Pvt. Ltd.',
  website: process.env.BUSINESS_WEBSITE || 'www.naturanzafood.com',
  email: process.env.BUSINESS_SUPPORT_EMAIL || 'support@naturanzafood.com',
  phone: process.env.BUSINESS_SUPPORT_PHONE || '+92340 9502646',
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
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(parsed)
    .replace(/\bam\b/g, 'AM')
    .replace(/\bpm\b/g, 'PM');
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

const drawPageBackground = (doc, pageWidth, pageHeight, margin, logoPath) => {
  doc
    .save()
    .rect(0, 0, pageWidth, pageHeight)
    .fill('#fdfefe')
    .restore();

  doc
    .save()
    .fillColor('#f0fdf4')
    .circle(pageWidth - 28, 24, 84)
    .fill()
    .restore();

  doc
    .save()
    .fillColor('#f7fee7')
    .circle(44, pageHeight - 52, 72)
    .fill()
    .restore();

  doc
    .save()
    .lineWidth(1)
    .strokeColor('#e5efe8')
    .roundedRect(18, 18, pageWidth - 36, pageHeight - 36, 18)
    .stroke()
    .restore();

  doc
    .save()
    .lineWidth(1.5)
    .strokeColor('#d7e9db')
    .moveTo(margin, 112)
    .lineTo(pageWidth - margin, 112)
    .stroke()
    .restore();

  if (logoPath) {
    try {
      doc
        .save()
        .opacity(0.045)
        .image(logoPath, pageWidth / 2 - 120, pageHeight / 2 - 68, {
          fit: [240, 136],
          align: 'center',
          valign: 'center',
        })
        .restore();
    } catch (_) {
      // Ignore watermark errors so invoice generation never fails.
    }
  }
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
    .text('#', columns.indexX, y + 8, {
      width: columns.indexWidth,
      align: 'center',
      lineBreak: false,
    })
    .text('Product Name', columns.productX + 8, y + 8, {
      width: columns.productWidth - 16,
      lineBreak: false,
    })
    .text('Qty', columns.qtyX, y + 8, {
      width: columns.qtyWidth,
      align: 'center',
      lineBreak: false,
    })
    .text('Unit Price', columns.unitX + 8, y + 8, {
      width: columns.unitWidth - 16,
      align: 'right',
      lineBreak: false,
    })
    .text('Amount', columns.amountX + 8, y + 8, {
      width: columns.amountWidth - 16,
      align: 'right',
      lineBreak: false,
    });
};

const createInvoicePdfBuffer = async (order, options = {}) => {
  const currency = options.currency || 'PKR';
  const company = { ...COMPANY, ...(options.company || {}) };

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 34,
        info: {
          Title: `Invoice ORD-${String(order.id || '').padStart(6, '0')}`,
          Author: company.legalName,
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

      drawPageBackground(doc, pageWidth, pageHeight, margin, logoPath);

      if (logoPath) {
        try {
          doc.image(logoPath, margin, margin + 4, {
            fit: [132, 52],
            align: 'left',
            valign: 'top',
          });
        } catch (_) {
          // Ignore logo errors so invoice generation never fails.
        }

        const logoWidth = 148;
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(MUTED_TEXT)
          .text(company.website, margin, margin + 60, {
            width: logoWidth,
            lineBreak: false,
          });
      }

      const rightWidth = 256;
      const rightX = pageWidth - margin - rightWidth;

      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(PRIMARY_GREEN)
        .text('Naturanza Invoice', rightX, margin + 4, {
          width: rightWidth,
          align: 'right',
          lineBreak: false,
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(DARK_TEXT)
        .text(orderNumber, rightX, margin + 28, {
          width: rightWidth,
          align: 'right',
          lineBreak: false,
        });

      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(MUTED_TEXT)
        .text(`Invoice Date: ${invoiceDate}`, rightX, margin + 50, {
          width: rightWidth,
          align: 'right',
          lineBreak: false,
        })
        .text(`Payment Method: ${paymentMethodText}`, rightX, margin + 65, {
          width: rightWidth,
          align: 'right',
          lineBreak: false,
        });

      const badgeWidth = Math.max(96, doc.widthOfString(statusText) + 32);
      const badgeHeight = 22;
      const badgeX = pageWidth - margin - badgeWidth;
      const badgeY = margin + 84;

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
        .text(statusText, badgeX, badgeY + 7, {
          width: badgeWidth,
          align: 'center',
          lineBreak: false,
        });

      let y = margin + 118;
      doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke(BORDER);

      y += 18;
      const cardGap = 14;
      const cardWidth = (contentWidth - cardGap) / 2;
      const cardPadding = 14;
      const cardBodyWidth = cardWidth - cardPadding * 2;

      const billToName = normalizeText(order.customer_name || order.user_name, 'Customer');
      const billToEmail = normalizeText(order.customer_email, '-');
      const billToAddress = normalizeText(order.shipping_address, 'Address not available');
      const billToBlock = [billToName, billToEmail, billToAddress].join('\n');
      const fromBlock = [
        company.legalName,
        company.email,
        company.phone,
        company.officeAddress,
      ].join('\n');

      doc.font('Helvetica').fontSize(9);
      const cardTextOptions = {
        width: cardBodyWidth,
        lineGap: 2,
      };
      const cardHeight = Math.max(
        98,
        50 + Math.max(
          doc.heightOfString(billToBlock, cardTextOptions),
          doc.heightOfString(fromBlock, cardTextOptions),
        ),
      );

      drawRoundedRect(doc, margin, y, cardWidth, cardHeight);
      drawRoundedRect(doc, margin + cardWidth + cardGap, y, cardWidth, cardHeight);

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(PRIMARY_GREEN)
        .text('Bill To', margin + cardPadding, y + 14)
        .text('From', margin + cardWidth + cardGap + cardPadding, y + 14);

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(DARK_TEXT)
        .text(billToBlock, margin + cardPadding, y + 34, {
          width: cardBodyWidth,
          lineGap: 2,
        });

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(DARK_TEXT)
        .text(fromBlock, margin + cardWidth + cardGap + cardPadding, y + 34, {
          width: cardBodyWidth,
          lineGap: 2,
        });

      y += cardHeight + 20;

      const columns = {
        startX: margin,
        totalWidth: contentWidth,
        indexX: margin,
        indexWidth: 36,
        productX: margin + 36,
        productWidth: 244,
        qtyX: margin + 280,
        qtyWidth: 56,
        unitX: margin + 336,
        unitWidth: 96,
        amountX: margin + 432,
        amountWidth: 95,
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
        const rowHeight = 30;

        if (y + rowHeight > pageHeight - 170) {
          doc.addPage();
          drawPageBackground(doc, pageWidth, pageHeight, margin, logoPath);
          y = margin + 10;
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
          .text(item._placeholder ? '-' : String(index + 1), columns.indexX, y + 10, {
            width: columns.indexWidth,
            align: 'center',
            lineBreak: false,
          })
          .text(normalizeText(item.product_name || item.name, 'Product'), columns.productX + 8, y + 8, {
            width: columns.productWidth - 16,
            ellipsis: true,
            lineBreak: false,
          })
          .text(quantity, columns.qtyX, y + 8, {
            width: columns.qtyWidth,
            align: 'center',
            lineBreak: false,
          })
          .text(item._placeholder ? '-' : formatMoney(unitPrice, currency), columns.unitX + 8, y + 10, {
            width: columns.unitWidth - 16,
            align: 'right',
            lineBreak: false,
          })
          .text(item._placeholder ? '-' : formatMoney(amount, currency), columns.amountX + 8, y + 10, {
            width: columns.amountWidth - 16,
            align: 'right',
            lineBreak: false,
          });

        y += rowHeight;
      });

      y += 16;
      const totalsBoxWidth = 244;
      const totalsX = pageWidth - margin - totalsBoxWidth;
      const totalValueX = totalsX + totalsBoxWidth - 14;
      const totalLabelWidth = 112;
      const totalValueWidth = 104;
      const totalRowGap = 18;
      const totalsBoxHeight = 128;

      if (y + totalsBoxHeight > pageHeight - 110) {
        doc.addPage();
        drawPageBackground(doc, pageWidth, pageHeight, margin, logoPath);
        y = margin + 20;
      }

      const subtotal = safeNumber(order.subtotal, 0);
      const tax = safeNumber(order.tax, 0);
      const shipping = safeNumber(order.shipping_cost, 0);
      const discount = safeNumber(order.discount_amount, 0);
      const grandTotal = safeNumber(order.total_amount, 0);

      doc
        .save()
        .roundedRect(totalsX, y, totalsBoxWidth, totalsBoxHeight, 12)
        .fill('#f8fafc')
        .restore();
      doc
        .save()
        .roundedRect(totalsX, y, totalsBoxWidth, totalsBoxHeight, 12)
        .stroke(BORDER)
        .restore();

      y += 16;

      const drawTotalRow = (label, value, config = {}) => {
        doc
          .font(config.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(config.size || 10)
          .fillColor(config.color || MUTED_TEXT)
          .text(label, totalsX + 14, y, {
            width: totalLabelWidth,
            align: 'left',
            lineBreak: false,
          })
          .text(value, totalValueX - totalValueWidth, y, {
            width: totalValueWidth,
            align: 'right',
            lineBreak: false,
          });

        y += config.step || totalRowGap;
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

      doc.moveTo(totalsX + 14, y - 6).lineTo(totalValueX, y - 6).stroke(BORDER);

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
        .text(`${company.email} | ${company.phone}`, margin, footerY + 27, {
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

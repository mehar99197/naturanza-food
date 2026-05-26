// Builds wa.me deep-links with professional payment-status messages
// (approval / rejection). Returns null if the phone is unusable so the
// caller can hide the button.

export function normalizePkPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (/^92\d{10}$/.test(digits)) return digits;              // already E.164 PK
  if (/^0\d{10}$/.test(digits))  return "92" + digits.slice(1); // 03xx... -> 923xx...
  if (/^\d{10}$/.test(digits))   return "92" + digits;       // 3xx... -> 923xx...
  return null;
}

const STAGE_LABELS = {
  full_payment: "full payment",
  advance_shipping: "delivery fee advance",
  final_collection: "cash on delivery",
};

const formatAmount = (amount, currency) => {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${currency || "Rs"} ${n.toLocaleString("en-PK")}`;
};

export function buildRejectionWhatsAppLink({
  customerName,
  customerPhone,
  orderId,
  rejectionReason,
}) {
  const phone = normalizePkPhone(customerPhone);
  if (!phone) return null;

  const name   = (customerName || "Customer").trim();
  const order  = String(orderId || "").trim();
  const reason = (rejectionReason || "Not specified").trim();

  // *bold* and _italic_ render natively on the WhatsApp client.
  const message =
    `Assalam o Alaikum *${name}*, this is the automated billing desk.\n\n` +
    `Your payment verification for Order *#${order}* has been marked as *Rejected* by our audit team.\n\n` +
    `Reason for Rejection: _${reason}_\n\n` +
    `Please initiate a fresh transfer or contact support immediately to avoid order cancellation.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildApprovalWhatsAppLink({
  customerName,
  customerPhone,
  orderId,
  amount,
  currency,
  verificationStage,
}) {
  const phone = normalizePkPhone(customerPhone);
  if (!phone) return null;

  const name = (customerName || "Customer").trim();
  const order = String(orderId || "").trim();
  const stage = STAGE_LABELS[String(verificationStage || "").toLowerCase()] || "payment";
  const amountText = formatAmount(amount, currency);

  const message =
    `Assalam o Alaikum *${name}*, this is the automated billing desk.\n\n` +
    `Your ${stage}${amountText ? ` of *${amountText}*` : ""} for Order *#${order}* has been *Approved* ✅\n\n` +
    `Your order is now being processed and you will receive further updates soon. Thank you for shopping with us!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

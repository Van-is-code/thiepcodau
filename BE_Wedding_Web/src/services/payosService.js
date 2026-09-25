// Wrapper mỏng quanh SDK chính thức @payos/node (v1.x).
// Env: PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY,
//      PAYOS_RETURN_URL, PAYOS_CANCEL_URL  (FE URL khách quay về sau khi thanh toán)
//
// PAYOS_MOCK=true : chế độ giả lập cho dev/test — KHÔNG gọi payOS thật, KHÔNG verify
//   chữ ký. Webhook chỉ cần gửi { data: { orderCode, amount, code:'00', reference } }.
//   Mặc định TẮT. Không bao giờ bật ở production.
let PayOS;
try {
  PayOS = require('@payos/node');
} catch (_e) {
  PayOS = null; // chưa cài dependency
}

const CLIENT_ID = process.env.PAYOS_CLIENT_ID || '';
const API_KEY = process.env.PAYOS_API_KEY || '';
const CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '';
const MOCK = String(process.env.PAYOS_MOCK || 'false').toLowerCase() === 'true';

let client = null;
const getClient = () => {
  if (!isConfigured()) {
    const e = new Error('Chưa cấu hình payOS. Thiếu PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY trong .env');
    e.status = 503;
    throw e;
  }
  if (!client) {
    client = new PayOS(CLIENT_ID, API_KEY, CHECKSUM_KEY);
  }
  return client;
};

const isConfigured = () => MOCK || Boolean(PayOS && CLIENT_ID && API_KEY && CHECKSUM_KEY);

// Sinh orderCode dạng số nguyên dương duy nhất (payOS yêu cầu). < 2^53.
const generateOrderCode = () =>
  Number(`${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`);

const FE = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

const createPaymentLink = async ({ orderCode, amount, description, returnUrl, cancelUrl, expiredAt, buyerName }) => {
  const amt = Math.round(Number(amount));

  if (MOCK) {
    return {
      checkoutUrl: `${FE || ''}/pay-mock?orderCode=${orderCode}&amount=${amt}`,
      qrCode: `MOCK|orderCode=${orderCode}|amount=${amt}`,
      paymentLinkId: `mock_${orderCode}`,
      orderCode,
      amount: amt,
      status: 'PENDING'
    };
  }

  const payos = getClient();
  const body = {
    orderCode,
    amount: amt,
    description: String(description || `Thanh toan don ${orderCode}`).slice(0, 25),
    returnUrl: returnUrl || process.env.PAYOS_RETURN_URL || '',
    cancelUrl: cancelUrl || process.env.PAYOS_CANCEL_URL || ''
  };
  if (expiredAt) body.expiredAt = Math.floor(new Date(expiredAt).getTime() / 1000);
  if (buyerName) body.buyerName = String(buyerName).slice(0, 100);

  const res = await payos.createPaymentLink(body);
  return {
    checkoutUrl: res.checkoutUrl,
    qrCode: res.qrCode,
    paymentLinkId: res.paymentLinkId,
    orderCode: res.orderCode,
    amount: res.amount,
    status: res.status
  };
};

const getPaymentLinkInfo = async (orderCode) => {
  if (MOCK) return { orderCode, status: 'PENDING', amount: 0, amountPaid: 0 };
  return getClient().getPaymentLinkInformation(orderCode);
};

const cancelPaymentLink = async (orderCode, reason = 'Huỷ đơn') => {
  if (MOCK) return { cancelled: true, orderCode, note: reason };
  try {
    return await getClient().cancelPaymentLink(orderCode, reason);
  } catch (error) {
    return { cancelled: true, note: error.message };
  }
};

// Verify chữ ký webhook. Trả về object `data` nếu hợp lệ, ném lỗi nếu không.
const verifyWebhook = (webhookBody) => {
  if (MOCK) {
    // Không verify — tin payload. Chấp nhận cả { data: {...} } lẫn phẳng {...}.
    const data = webhookBody && typeof webhookBody === 'object' && webhookBody.data ? webhookBody.data : webhookBody;
    if (!data || data.orderCode == null) {
      const e = new Error('[mock] webhook thiếu data.orderCode');
      throw e;
    }
    return data;
  }
  return getClient().verifyPaymentWebhookData(webhookBody);
};

const confirmWebhook = async (webhookUrl) => {
  if (MOCK) return { ok: true, mock: true, webhookUrl };
  return getClient().confirmWebhook(webhookUrl);
};

module.exports = {
  isConfigured,
  isMock: () => MOCK,
  generateOrderCode,
  createPaymentLink,
  getPaymentLinkInfo,
  cancelPaymentLink,
  verifyWebhook,
  confirmWebhook
};

// payOS Payouts — CHI HỘ (chi trả thay mặt nền tảng tới tài khoản ngân hàng CTV).
//
// Khác với payosService.js (thu tiền vào — thu hộ), tệp này gọi nhóm API Payout để
// CHUYỂN TIỀN RA. payOS yêu cầu riêng một cặp khoá Payout + chữ ký HMAC-SHA256 trên
// phần thân đã sắp xếp khoá theo bảng chữ cái.
//
// Env:
//   PAYOS_PAYOUT_CLIENT_ID      Client ID của kênh chi hộ
//   PAYOS_PAYOUT_API_KEY        API key của kênh chi hộ
//   PAYOS_PAYOUT_CHECKSUM_KEY   Khoá ký chữ ký
//   PAYOS_PAYOUT_BASE_URL       Mặc định https://api-merchant.payos.vn
//   PAYOS_PAYOUT_MOCK=true      Giả lập cho dev/test — KHÔNG gọi API thật.
const crypto = require('crypto');
const axios = require('axios');

const CLIENT_ID = process.env.PAYOS_PAYOUT_CLIENT_ID || '';
const API_KEY = process.env.PAYOS_PAYOUT_API_KEY || '';
const CHECKSUM_KEY = process.env.PAYOS_PAYOUT_CHECKSUM_KEY || '';
const BASE_URL = (process.env.PAYOS_PAYOUT_BASE_URL || 'https://api-merchant.payos.vn').replace(/\/+$/, '');
const MOCK = String(process.env.PAYOS_PAYOUT_MOCK || 'false').toLowerCase() === 'true';
const TIMEOUT_MS = Number.parseInt(process.env.PAYOS_PAYOUT_TIMEOUT_MS, 10) || 20000;

const isConfigured = () => MOCK || Boolean(CLIENT_ID && API_KEY && CHECKSUM_KEY);

const requireConfig = () => {
  if (!isConfigured()) {
    const e = new Error('Chưa cấu hình chi hộ payOS. Thiếu PAYOS_PAYOUT_CLIENT_ID / PAYOS_PAYOUT_API_KEY / PAYOS_PAYOUT_CHECKSUM_KEY.');
    e.status = 503;
    throw e;
  }
};

// Chữ ký: ghép "key=value" theo THỨ TỰ BẢNG CHỮ CÁI của khoá, nối bằng "&", rồi
// HMAC-SHA256 với checksum key. Sai thứ tự -> payOS từ chối với lỗi chữ ký.
const signPayload = (payload) => {
  const sorted = Object.keys(payload)
    .filter((k) => payload[k] !== undefined && payload[k] !== null)
    .sort()
    .map((k) => k + '=' + payload[k])
    .join('&');
  return crypto.createHmac('sha256', CHECKSUM_KEY).update(sorted).digest('hex');
};

// So sánh chữ ký bằng thuật toán thời gian hằng số: dùng === sẽ rò rỉ thông tin qua
// thời gian phản hồi, cho phép dò dần từng byte chữ ký đúng.
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const client = () => axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT_MS,
  headers: {
    'x-client-id': CLIENT_ID,
    'x-api-key': API_KEY,
    'Content-Type': 'application/json',
  },
});

/**
 * Tạo 1 lệnh chi hộ tới tài khoản ngân hàng của CTV.
 *
 * referenceId là KHOÁ CHỐNG TRÙNG: gửi lại cùng referenceId thì payOS trả về đúng
 * lệnh cũ chứ không chi thêm lần nữa. Ta dùng chính id phiếu rút -> mạng chập chờn
 * hay bấm duyệt hai lần cũng KHÔNG bao giờ chuyển tiền hai lần.
 */
const createPayout = async ({
  referenceId, amount, toBin, toAccountNumber, toAccountName, description,
}) => {
  requireConfig();

  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    const e = new Error('Số tiền chi hộ phải lớn hơn 0'); e.status = 400; throw e;
  }
  if (!toBin || !toAccountNumber) {
    const e = new Error('Thiếu mã ngân hàng (BIN) hoặc số tài khoản người nhận'); e.status = 400; throw e;
  }

  // payOS giới hạn mô tả 25 ký tự và chỉ nhận chữ/số không dấu.
  const desc = String(description || ('RUT ' + referenceId))
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .slice(0, 25);

  const body = {
    referenceId: String(referenceId),
    amount: amt,
    description: desc,
    toBin: String(toBin),
    toAccountNumber: String(toAccountNumber),
  };

  if (MOCK) {
    return {
      id: 'mock_payout_' + referenceId,
      referenceId: body.referenceId,
      amount: amt,
      state: 'SUCCEEDED',
      toAccountName: toAccountName || 'MOCK ACCOUNT',
      transactions: [{ reference: 'MOCKREF' + Date.now(), amount: amt, state: 'SUCCEEDED' }],
      mock: true,
    };
  }

  const signature = signPayload(body);
  const res = await client().post('/v1/payouts', body, {
    headers: {
      signature,
      // Header idempotency của payOS: lớp chống trùng thứ hai ở tầng HTTP.
      'x-idempotency-key': String(referenceId),
    },
  });

  const data = res.data && res.data.data ? res.data.data : res.data;
  if (res.data && res.data.code && res.data.code !== '00') {
    const e = new Error('payOS từ chối lệnh chi: ' + (res.data.desc || res.data.code));
    e.status = 400;
    e.providerCode = res.data.code;
    throw e;
  }
  return data;
};

// Tra trạng thái 1 lệnh chi (dùng khi webhook không tới hoặc cần đối soát).
const getPayout = async (payoutId) => {
  requireConfig();
  if (MOCK) return { id: payoutId, state: 'SUCCEEDED', mock: true };
  const res = await client().get('/v1/payouts/' + encodeURIComponent(payoutId));
  return res.data && res.data.data ? res.data.data : res.data;
};

// Số dư tài khoản chi hộ — kiểm trước khi duyệt để không tạo lệnh chắc chắn hỏng.
const getBalance = async () => {
  requireConfig();
  if (MOCK) return { balance: 999000000, mock: true };
  const res = await client().get('/v1/payouts-account/balance');
  return res.data && res.data.data ? res.data.data : res.data;
};

/**
 * Kiểm chữ ký webhook chi hộ. Trả về `data` nếu hợp lệ, ném lỗi nếu không.
 *
 * Bắt buộc phải verify: webhook là endpoint công khai, nếu tin payload thì bất kỳ ai
 * cũng POST giả một lệnh chi "SUCCEEDED" để phiếu rút được đánh dấu đã trả.
 */
const verifyPayoutWebhook = (webhookBody) => {
  const data = webhookBody && webhookBody.data ? webhookBody.data : null;
  if (!data) {
    const e = new Error('Webhook chi hộ thiếu trường data'); e.status = 400; throw e;
  }
  if (MOCK) return data;

  requireConfig();
  const expected = signPayload(data);
  if (!safeEqual(expected, webhookBody.signature)) {
    const e = new Error('Chữ ký webhook chi hộ không hợp lệ'); e.status = 401; throw e;
  }
  return data;
};

// Chuẩn hoá trạng thái của payOS về 3 nhóm mà nghiệp vụ quan tâm.
const normalizeState = (state) => {
  const s = String(state || '').toUpperCase();
  if (['SUCCEEDED', 'SUCCESS', 'COMPLETED'].includes(s)) return 'succeeded';
  if (['FAILED', 'CANCELLED', 'REJECTED', 'REVERSED'].includes(s)) return 'failed';
  return 'processing';
};

module.exports = {
  isConfigured,
  isMock: () => MOCK,
  createPayout,
  getPayout,
  getBalance,
  verifyPayoutWebhook,
  normalizeState,
  signPayload,
  safeEqual,
};

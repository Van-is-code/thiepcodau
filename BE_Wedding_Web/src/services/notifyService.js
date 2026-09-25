// Thông báo Telegram — 4 kênh độc lập, mỗi kênh 1 bot riêng (token + chat_id trong .env):
//   alert    -> Lỗi hệ thống / cảnh báo
//   payment  -> Đơn hàng & thanh toán
//   payout   -> Phiếu rút tiền
//   customer -> Tài khoản khách (tạo / kích hoạt)
//
// Nguyên tắc: fire-and-forget, KHÔNG bao giờ ném lỗi ra luồng nghiệp vụ.
// Kênh chưa cấu hình (thiếu token/chat_id) -> im lặng, không lỗi.
const axios = require('axios');

const MASTER_ON = String(process.env.TELEGRAM_ENABLED ?? 'true').toLowerCase() !== 'false';
const TZ = process.env.TELEGRAM_TZ || 'Asia/Ho_Chi_Minh';
const FE = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

const parseIds = (raw) => String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);

const CHANNELS = {
  alert: {
    token: process.env.TELEGRAM_ALERT_BOT_TOKEN,
    chatIds: parseIds(process.env.TELEGRAM_ALERT_CHAT_ID),
    thread: process.env.TELEGRAM_ALERT_THREAD_ID
  },
  payment: {
    token: process.env.TELEGRAM_PAYMENT_BOT_TOKEN,
    chatIds: parseIds(process.env.TELEGRAM_PAYMENT_CHAT_ID),
    thread: process.env.TELEGRAM_PAYMENT_THREAD_ID
  },
  payout: {
    token: process.env.TELEGRAM_PAYOUT_BOT_TOKEN,
    chatIds: parseIds(process.env.TELEGRAM_PAYOUT_CHAT_ID),
    thread: process.env.TELEGRAM_PAYOUT_THREAD_ID
  },
  customer: {
    token: process.env.TELEGRAM_CUSTOMER_BOT_TOKEN,
    chatIds: parseIds(process.env.TELEGRAM_CUSTOMER_CHAT_ID),
    thread: process.env.TELEGRAM_CUSTOMER_THREAD_ID
  }
};

// ---------- tiện ích định dạng ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtTime = (d = new Date()) => {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);
  } catch (_e) {
    return date.toISOString();
  }
};

const money = (v) => `${Math.round(Number(v) || 0).toLocaleString('vi-VN')}đ`;
const shortId = (id) => String(id || '').slice(0, 8);
const productLabel = (code) =>
  code === 'combo' ? 'Combo 2 thiệp' : code === 'single' ? '1 thiệp lẻ' : (code || 'đơn');

const humanDuration = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} ngày${h ? ` ${h} giờ` : ''}`;
  if (h) return `${h} giờ${m ? ` ${m} phút` : ''}`;
  if (m) return `${m} phút`;
  return `${s} giây`;
};

// ---------- gửi ----------
const recentAlerts = new Map();
const ALERT_DEDUP_MS = Number(process.env.TELEGRAM_ALERT_DEDUP_MS) || 5 * 60 * 1000;

const rawSend = async (channelKey, text) => {
  if (!MASTER_ON) return;
  const ch = CHANNELS[channelKey];
  if (!ch || !ch.token || !ch.chatIds.length) return; // kênh chưa cấu hình

  for (const chatId of ch.chatIds) {
    const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (ch.thread) body.message_thread_id = Number(ch.thread);

    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await axios.post(`https://api.telegram.org/bot${ch.token}/sendMessage`, body, { timeout: 8000 });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    if (lastErr) {
      const reason = lastErr.response?.data?.description || lastErr.message;
      console.error(`[notify:${channelKey}] gửi thất bại (chat ${chatId}): ${reason}`);
    }
  }
};

// fire-and-forget — không await, không ném lỗi
const send = (channelKey, text, dedupKey) => {
  try {
    if (channelKey === 'alert' && dedupKey) {
      const now = Date.now();
      const last = recentAlerts.get(dedupKey);
      if (last && now - last < ALERT_DEDUP_MS) return;
      recentAlerts.set(dedupKey, now);
      if (recentAlerts.size > 300) {
        for (const [k, t] of recentAlerts) if (now - t > ALERT_DEDUP_MS) recentAlerts.delete(k);
      }
    }
    Promise.resolve().then(() => rawSend(channelKey, text)).catch(() => {});
  } catch (_e) { /* thông báo lỗi không được làm hỏng nghiệp vụ */ }
};

// ============ API dùng ở các service ============

// ----- Kênh LỖI -----
const alert = (title, detail, dedupKey) =>
  send('alert', `🔥 <b>${esc(title)}</b>\n${esc(detail || '')}\n<i>${fmtTime()}</i>`, dedupKey);

const warn = (title, detail, dedupKey) =>
  send('alert', `⚠️ <b>${esc(title)}</b>\n${esc(detail || '')}\n<i>${fmtTime()}</i>`, dedupKey);

const info = (title, detail) =>
  send('alert', `ℹ️ <b>${esc(title)}</b>\n${esc(detail || '')}\n<i>${fmtTime()}</i>`);

// ----- Kênh THANH TOÁN -----
const orderCreated = ({ order, ctvName, customerName }) => {
  send('payment',
    `🧾 <b>Đơn mới</b>  #${esc(shortId(order.id))}\n` +
    `${productLabel(order.product_code)} · <b>${money(order.amount)}</b>\n` +
    `CTV: ${esc(ctvName || '—')}  →  Khách: ${esc(customerName || '—')}\n` +
    `⏳ Chờ thanh toán · ${fmtTime(order.created_at)}`);
};

const orderPaid = ({ order, ctvName, customerName }) => {
  send('payment',
    `💰 <b>ĐÃ THANH TOÁN</b>  #${esc(shortId(order.id))}\n` +
    `${productLabel(order.product_code)} · <b>${money(order.amount)}</b>\n` +
    `Khách: ${esc(customerName || '—')} · CTV: ${esc(ctvName || '—')}\n` +
    `Hoa hồng nền tảng: ${money(order.commission_amount)} · CTV nhận: <b>${money(order.ctv_earning_amount)}</b>\n` +
    `${fmtTime(order.paid_at || new Date())}`);
};

const orderRefunded = ({ order, reason, adminName }) => {
  send('payment',
    `↩️ <b>HOÀN TIỀN</b>  #${esc(shortId(order.id))}\n` +
    `${money(order.amount)} · lý do: ${esc(reason || '—')}\n` +
    `Đã đảo ${order.card_quantity || 1} lượt thiệp + trừ hoa hồng CTV ${money(order.ctv_earning_amount)}\n` +
    `${adminName ? `Bởi: ${esc(adminName)} · ` : ''}${fmtTime()}`);
};

// ----- Kênh RÚT TIỀN -----
const payoutRequested = ({ request, ctv }) => {
  const auto = request.type === 'auto';
  const bank = ctv && ctv.bank_name
    ? `TK: ${esc(ctv.bank_name)} ${esc(ctv.bank_account_number || '')} (${esc(ctv.bank_account_name || '')})\n`
    : 'TK: (CTV chưa điền thông tin ngân hàng)\n';
  const link = FE ? `\n<a href="${FE}/admin">Mở trang duyệt phiếu rút</a>` : '';
  send('payout',
    `${auto ? '🤖' : '🏦'} <b>${auto ? 'Phiếu rút TỰ ĐỘNG' : 'Yêu cầu rút tiền'}</b>\n` +
    `CTV: ${esc(ctv?.display_name || '—')} · <b>${money(request.amount)}</b>\n` +
    bank +
    (request.note ? `Ghi chú: ${esc(request.note)}\n` : '') +
    `⏳ Chờ bạn duyệt & chuyển khoản · ${fmtTime(request.created_at)}${link}`);
};

const payoutApproved = ({ request, ctvName, adminName }) => {
  send('payout',
    `✅ <b>Đã duyệt rút tiền</b>\n` +
    `CTV: ${esc(ctvName || '—')} · <b>${money(request.amount)}</b>\n` +
    `Mã CK: ${esc(request.payment_reference || '—')} · đã trừ ví\n` +
    `${adminName ? `Bởi: ${esc(adminName)} · ` : ''}${fmtTime()}`);
};

const payoutRejected = ({ request, ctvName, adminName }) => {
  send('payout',
    `❌ <b>Từ chối rút tiền</b>\n` +
    `CTV: ${esc(ctvName || '—')} · ${money(request.amount)}\n` +
    `Lý do: ${esc(request.admin_note || '—')} · đã hoàn lại ví\n` +
    `${adminName ? `Bởi: ${esc(adminName)} · ` : ''}${fmtTime()}`);
};

const payoutCancelled = ({ request, ctvName }) => {
  send('payout',
    `🚫 <b>CTV tự huỷ phiếu rút</b>\n` +
    `CTV: ${esc(ctvName || '—')} · ${money(request.amount)} · đã hoàn lại ví\n` +
    `${fmtTime()}`);
};

// ----- Kênh KHÁCH HÀNG -----
const customerCreated = ({ customer, ctvName }) => {
  send('customer',
    `🆕 <b>Khách mới</b>\n` +
    `${esc(customer.name || customer.username || '—')}${customer.username ? `  (đăng nhập: ${esc(customer.username)})` : ''}\n` +
    (customer.phone ? `SĐT: ${esc(customer.phone)}\n` : '') +
    `CTV phụ trách: ${esc(ctvName || '—')}\n` +
    `Trạng thái: ⏳ chờ kích hoạt\n` +
    `Tạo lúc: ${fmtTime(customer.created_at)}`);
};

const customerActivated = ({ customer, orderId }) => {
  const created = customer.created_at ? new Date(customer.created_at) : null;
  const dur = created ? humanDuration(Date.now() - created.getTime()) : null;
  send('customer',
    `✅ <b>Khách đã kích hoạt</b>\n` +
    `${esc(customer.name || customer.username || '—')}\n` +
    `Tạo lúc:      ${fmtTime(customer.created_at)}\n` +
    `Kích hoạt lúc: ${fmtTime()}${dur ? `  (sau ${dur})` : ''}\n` +
    (orderId ? `Đơn kích hoạt: #${esc(shortId(orderId))}` : ''));
};

module.exports = {
  // hạ tầng
  fmtTime, money, shortId,
  // kênh lỗi
  alert, warn, info,
  // kênh thanh toán
  orderCreated, orderPaid, orderRefunded,
  // kênh rút tiền
  payoutRequested, payoutApproved, payoutRejected, payoutCancelled,
  // kênh khách hàng
  customerCreated, customerActivated
};

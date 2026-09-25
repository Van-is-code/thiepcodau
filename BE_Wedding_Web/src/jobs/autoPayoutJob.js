// Bộ hẹn giờ nhẹ (không thêm dependency): giám sát + rút tiền tự động.
// - Luôn chạy: kiểm bất biến ví (balance == SUM sổ cái) -> lệch thì báo Bot Lỗi.
// - Quét tạo phiếu rút theo lịch tuần: bật/tắt ngay trên trang quản trị
//   (Phiếu Rút -> Chính sách rút tiền), không phải sửa .env rồi dựng lại.
const payoutService = require('../services/payoutService');
const notifyService = require('../services/notifyService');

const INTERVAL_MS = Number(process.env.AUTO_PAYOUT_INTERVAL_MS) || 15 * 60 * 1000;
// Đọc từ CSDL mỗi lần chạy: admin bật/tắt là lần quét kế tiếp theo ngay, không
// phải khởi động lại tiến trình.
const SWEEP_ON = async () => {
  try { return Boolean((await payoutService.getPolicy()).auto_sweep_enabled); }
  catch (_e) { return false; }
};
let timer = null;

const checkWalletIntegrity = async () => {
  try {
    const { Wallet, WalletTransaction } = require('../models');
    const { roundVnd } = require('../utils/money');
    const wallets = await Wallet.findAll();
    for (const w of wallets) {
      const sum = (await WalletTransaction.sum('amount', { where: { wallet_id: w.id } })) || 0;
      if (roundVnd(sum) !== roundVnd(w.balance)) {
        notifyService.alert(
          'Ví CTV lệch sổ cái',
          `ctv_id=${w.ctv_id} · balance=${roundVnd(w.balance)} · SUM(sổ cái)=${roundVnd(sum)}`,
          `wallet-mismatch:${w.id}`
        );
      }
    }
  } catch (error) {
    console.error('[monitor] kiểm ví lỗi:', error.message);
  }
};

const tick = async () => {
  await checkWalletIntegrity();

  if (!(await SWEEP_ON())) return;
  try {
    const result = await payoutService.runAutoSweep({ trigger: 'cron' });
    if (result.created && result.created.length) {
      console.log(`[auto-payout] đã tạo ${result.created.length} phiếu rút tự động.`);
    }
  } catch (error) {
    console.error('[auto-payout] lỗi sweep:', error.message);
    notifyService.alert('Auto-payout sweep lỗi', error.message || String(error), 'autopayout:err');
  }
};

const start = () => {
  if (timer) return;
  console.log(`[monitor] bật — kiểm mỗi ${Math.round(INTERVAL_MS / 60000)} phút.`
    + ' Quét rút tự động bật/tắt ở trang quản trị.');
  setTimeout(tick, 30 * 1000);
  timer = setInterval(tick, INTERVAL_MS);
  if (timer.unref) timer.unref();
};

const stop = () => {
  if (timer) { clearInterval(timer); timer = null; }
};

module.exports = { start, stop, tick };

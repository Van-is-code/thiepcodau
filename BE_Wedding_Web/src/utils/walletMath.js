// Toán ledger ví — thuần, không phụ thuộc DB. VND làm tròn về đồng.
const { roundVnd } = require('./money');

// Số dư mới sau khi cộng 1 dòng ledger (amount có dấu).
function applyWalletAmount(balance, amount) {
  return roundVnd(roundVnd(balance) + roundVnd(amount));
}

// Tổng của cả ledger — phải luôn bằng wallet.balance.
function reduceLedger(amounts) {
  return amounts.reduce((sum, a) => roundVnd(sum + roundVnd(a)), 0);
}

module.exports = { applyWalletAmount, reduceLedger };

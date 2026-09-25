// Toán bộ đếm entitlement thiệp — thuần, không phụ thuộc DB (test được độc lập).
// Purchased: tổng lượt đã mua. Used: tổng thiệp đã tạo. Available = Purchased - Used (>= 0).

const REASONS = ['purchase', 'card_created', 'refund', 'admin_adjust'];

// Áp 1 biến động lên bộ đếm hiện tại, trả về bộ đếm mới.
//   purchase / refund / admin_adjust : delta cộng thẳng vào Purchased (refund âm)
//   card_created                     : delta = -1 -> Used += 1
function applyEntitlementDelta({ purchased, used }, { delta, reason }) {
  if (!REASONS.includes(reason)) {
    throw new Error(`reason không hợp lệ: ${reason}`);
  }
  let p = Number(purchased) || 0;
  let u = Number(used) || 0;

  if (reason === 'card_created') {
    u += -delta;
  } else {
    p += delta;
  }

  const availableRaw = p - u;
  return {
    purchased: p,
    used: u,
    available: Math.max(availableRaw, 0),
    available_raw: availableRaw,
    warn_negative: availableRaw < 0
  };
}

module.exports = { REASONS, applyEntitlementDelta };

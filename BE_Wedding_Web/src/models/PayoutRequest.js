const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PayoutRequest = sequelize.define('PayoutRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  ctv_id: { type: DataTypes.UUID, allowNull: false },
  wallet_id: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  type: { type: DataTypes.ENUM('manual', 'auto'), allowNull: false, defaultValue: 'manual' },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  requested_by: { type: DataTypes.ENUM('ctv', 'system'), allowNull: false, defaultValue: 'ctv' },
  hold_txn_id: { type: DataTypes.UUID, allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true },
  admin_note: { type: DataTypes.TEXT, allowNull: true },
  payment_reference: { type: DataTypes.STRING(120), allowNull: true },
  approved_by: { type: DataTypes.UUID, allowNull: true },
  approved_at: { type: DataTypes.DATE, allowNull: true },
  rejected_at: { type: DataTypes.DATE, allowNull: true },
  period_start: { type: DataTypes.DATE, allowNull: true },
  period_end: { type: DataTypes.DATE, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },

  // ----- Chi hộ qua payOS (migration 20260914000002) -----
  // 'manual' = admin tự chuyển khoản | 'payos' = chi hộ tự động.
  provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual' },
  // UNIQUE ở DB: 1 phiếu không thể gắn 2 lệnh chi -> không bao giờ chuyển tiền 2 lần.
  provider_payout_id: { type: DataTypes.STRING(120), allowNull: true },
  provider_state: { type: DataTypes.STRING(20), allowNull: true },
  provider_reference: { type: DataTypes.STRING(120), allowNull: true },
  failure_reason: { type: DataTypes.TEXT, allowNull: true },
  // Ảnh chụp thông tin ngân hàng tại thời điểm duyệt.
  bank_snapshot: { type: DataTypes.JSONB, allowNull: true },
  provider_payload: { type: DataTypes.JSONB, allowNull: true },
  disbursed_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'payout_requests',
  timestamps: false
});

module.exports = PayoutRequest;

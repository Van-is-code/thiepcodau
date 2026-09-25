const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WalletTransaction = sequelize.define('WalletTransaction', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  wallet_id: { type: DataTypes.UUID, allowNull: false },
  ctv_id: { type: DataTypes.UUID, allowNull: false },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  type: {
    type: DataTypes.ENUM('commission_credit', 'refund_debit', 'payout_hold', 'payout_release', 'adjustment'),
    allowNull: false
  },
  order_id: { type: DataTypes.UUID, allowNull: true },
  payout_request_id: { type: DataTypes.UUID, allowNull: true },
  balance_after: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  note: { type: DataTypes.STRING(255), allowNull: true },
  created_by: { type: DataTypes.ENUM('system', 'admin', 'cron'), allowNull: false, defaultValue: 'system' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'wallet_transactions',
  timestamps: false
});

module.exports = WalletTransaction;

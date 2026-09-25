const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PaymentTransaction = sequelize.define('PaymentTransaction', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  order_id: { type: DataTypes.UUID, allowNull: false },
  provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'payos' },
  event_id: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  provider_txn_ref: { type: DataTypes.STRING(120), allowNull: true },
  amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'succeeded', 'failed'), allowNull: false, defaultValue: 'pending' },
  signature_valid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  raw_payload: { type: DataTypes.JSONB, allowNull: true },
  processed_at: { type: DataTypes.DATE, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'payment_transactions',
  timestamps: false
});

module.exports = PaymentTransaction;

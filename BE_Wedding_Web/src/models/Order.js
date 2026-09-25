const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  users_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  slot_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  status: {
    // ENUM Postgres đã mở rộng ở migration 20260901000004: + expired, refunded
    type: DataTypes.ENUM('pending', 'paid', 'cancelled', 'expired', 'refunded'),
    allowNull: false,
    defaultValue: 'pending'
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  transfer_content: {
    type: DataTypes.STRING(255),
    allowNull: false
  },

  // ----- Luồng CTV (migration 20260901000004). Đơn SePay cũ để null. -----
  kind: {
    type: DataTypes.ENUM('legacy_slot', 'ctv'),
    allowNull: false,
    defaultValue: 'legacy_slot'
  },
  ctv_id: { type: DataTypes.UUID, allowNull: true },
  customer_id: { type: DataTypes.UUID, allowNull: true },
  product_id: { type: DataTypes.UUID, allowNull: true },
  product_code: { type: DataTypes.STRING(20), allowNull: true },
  card_quantity: { type: DataTypes.INTEGER, allowNull: true },
  admin_base_price: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  ctv_selling_price: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  commission_rate: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
  commission_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  ctv_earning_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  payment_provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'payos' },
  payos_order_code: { type: DataTypes.BIGINT, allowNull: true, unique: true },
  payos_payment_link_id: { type: DataTypes.STRING(64), allowNull: true },
  payos_checkout_url: { type: DataTypes.STRING(500), allowNull: true },
  payos_qr: { type: DataTypes.TEXT, allowNull: true },
  order_token: { type: DataTypes.UUID, allowNull: true, unique: true },
  expired_at: { type: DataTypes.DATE, allowNull: true },
  paid_at: { type: DataTypes.DATE, allowNull: true },

  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'orders',
  timestamps: false
});

module.exports = Order;

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CardEntitlement = sequelize.define('CardEntitlement', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  customer_id: { type: DataTypes.UUID, allowNull: false },
  order_id: { type: DataTypes.UUID, allowNull: true },
  invitation_id: { type: DataTypes.UUID, allowNull: true },
  delta: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.ENUM('purchase', 'card_created', 'refund', 'admin_adjust'), allowNull: false },
  purchased_after: { type: DataTypes.INTEGER, allowNull: false },
  used_after: { type: DataTypes.INTEGER, allowNull: false },
  available_after: { type: DataTypes.INTEGER, allowNull: false },
  note: { type: DataTypes.STRING(255), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'card_entitlements',
  timestamps: false
});

module.exports = CardEntitlement;

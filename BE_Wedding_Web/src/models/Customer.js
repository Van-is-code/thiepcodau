const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  user_id: { type: DataTypes.UUID, allowNull: false, unique: true },
  ctv_id: { type: DataTypes.UUID, allowNull: true },
  name: { type: DataTypes.STRING(150), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  phone: { type: DataTypes.STRING(30), allowNull: true },
  status: { type: DataTypes.ENUM('pending_payment', 'active', 'locked'), allowNull: false, defaultValue: 'pending_payment' },
  cards_purchased: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  cards_used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  cards_available: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  activated_at: { type: DataTypes.DATE, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'customers',
  timestamps: false
});

module.exports = Customer;

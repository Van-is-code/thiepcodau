const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Wallet = sequelize.define('Wallet', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  ctv_id: { type: DataTypes.UUID, allowNull: false, unique: true },
  balance: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  pending_balance: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  total_earned: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  total_paid: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'wallets',
  timestamps: false
});

module.exports = Wallet;

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  transfer_content: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'sepay'
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
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
  tableName: 'invoices',
  timestamps: false
});

module.exports = Invoice;

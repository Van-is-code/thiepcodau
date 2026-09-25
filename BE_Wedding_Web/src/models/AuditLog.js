const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  actor_type: { type: DataTypes.ENUM('admin', 'ctv', 'system', 'customer'), allowNull: false },
  actor_id: { type: DataTypes.UUID, allowNull: true },
  action: { type: DataTypes.STRING(60), allowNull: false },
  entity_type: { type: DataTypes.STRING(40), allowNull: false },
  entity_id: { type: DataTypes.UUID, allowNull: true },
  old_value: { type: DataTypes.JSONB, allowNull: true },
  new_value: { type: DataTypes.JSONB, allowNull: true },
  ip: { type: DataTypes.STRING(60), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'audit_logs',
  timestamps: false
});

module.exports = AuditLog;

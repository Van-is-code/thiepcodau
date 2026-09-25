const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AppSetting = sequelize.define('AppSetting', {
  key: { type: DataTypes.STRING(60), primaryKey: true, allowNull: false },
  value: { type: DataTypes.JSONB, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'app_settings',
  timestamps: false
});

module.exports = AppSetting;

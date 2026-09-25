const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Cấp quyền dùng 1 mẫu thiệp cho 1 CTV / 1 khách hàng / 1 tài khoản.
const TemplatePermission = sequelize.define('TemplatePermission', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  template_id: { type: DataTypes.UUID, allowNull: false },
  // 'ctv' | 'customer' | 'user'
  grantee_type: { type: DataTypes.STRING(16), allowNull: false },
  grantee_id: { type: DataTypes.UUID, allowNull: false },
  // Tắt tạm mà không xoá dòng -> giữ lịch sử ai từng được cấp.
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  note: { type: DataTypes.TEXT, allowNull: true },
  granted_by: { type: DataTypes.UUID, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'template_permissions',
  timestamps: false,
});

module.exports = TemplatePermission;

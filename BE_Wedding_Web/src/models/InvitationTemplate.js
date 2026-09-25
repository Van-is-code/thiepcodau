const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const InvitationTemplate = sequelize.define('InvitationTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  template_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  template_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  html_path: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  // null = suy từ manifest (theme có thẻ <audio> hay không). true/false = admin chốt tay.
  has_music_box: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },

  status: {
    // 'draft' | 'published' — chỉ mẫu 'published' mới nên hiển thị cho khách chọn
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft'
  },
  schema: {
    // Mô tả các field/slot riêng mà mẫu này cần ngoài field chuẩn của Invitation
    // vd: { fields: [{ key: 'accent_color', label: 'Màu chủ đạo', type: 'color' }] }
    type: DataTypes.JSONB,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: { type: DataTypes.DATE, allowNull: true },

  // ----- Phân quyền mẫu (migration 20260923000001) -----
  // 'public' | 'restricted' | 'exclusive'
  visibility: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'public' },
  // Chỉ dùng khi visibility='exclusive': mẫu riêng của đúng 1 khách hàng.
  owner_customer_id: { type: DataTypes.UUID, allowNull: true },
  created_by: { type: DataTypes.UUID, allowNull: true },
  thumbnail_url: { type: DataTypes.STRING(500), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  // Manifest do bộ chuyển đổi theme sinh ra.
  manifest: { type: DataTypes.JSONB, allowNull: true },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  // ----- Quyền sửa của người dùng cuối (migration 20260923000003) -----
  // null = dùng bộ mặc định; [] = khoá hết; mảng khoá = đúng những gì được chọn.
  editable_fields: { type: DataTypes.JSONB, allowNull: true },
  // { gallery: { max: 12, allow_add: true }, cover: { allow_change: true }, ... }
  image_slot_rules: { type: DataTypes.JSONB, allowNull: true }
}, {
  tableName: 'invitation_templates',
  timestamps: false
});

module.exports = InvitationTemplate;

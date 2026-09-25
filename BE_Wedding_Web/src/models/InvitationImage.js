const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const InvitationImage = sequelize.define('InvitationImage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  users_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  invitation_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'invitations',
      key: 'id'
    }
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  image_alt: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  image_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'gallery'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  is_cover: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // ----- Kho ảnh + tối ưu tải (migration 20260914000001) -----
  // 'r2' | 'local' — biết ảnh nằm đâu để xoá đúng chỗ khi người dùng thay ảnh.
  storage_driver: { type: DataTypes.STRING(16), allowNull: true },
  // Khoá object của ảnh chính. Các phiên bản khác nằm trong `variants`.
  storage_key: { type: DataTypes.STRING(500), allowNull: true },
  width: { type: DataTypes.INTEGER, allowNull: true },
  height: { type: DataTypes.INTEGER, allowNull: true },
  bytes: { type: DataTypes.INTEGER, allowNull: true },
  // Ảnh nhoè ~16px dạng data URI, nhúng thẳng vào HTML -> hiện ngay lập tức.
  blur_data_url: { type: DataTypes.TEXT, allowNull: true },
  dominant_color: { type: DataTypes.STRING(16), allowNull: true },
  // { avif: [{width,height,bytes,key,url}], webp: [...], jpeg: [...] } -> dựng srcset.
  variants: { type: DataTypes.JSONB, allowNull: true }
}, {
  tableName: 'invitation_images',
  timestamps: false
});

module.exports = InvitationImage;

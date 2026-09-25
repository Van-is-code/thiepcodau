const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MusicTrack = sequelize.define('MusicTrack', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  title: { type: DataTypes.STRING(255), allowNull: false },
  url: { type: DataTypes.STRING(1000), allowNull: false },
  source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'link' },
  artist: { type: DataTypes.STRING(255), allowNull: true },

  // public = mọi khách chọn được. exclusive = chỉ đúng 1 khách hàng.
  visibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'public' },
  owner_customer_id: { type: DataTypes.UUID, allowNull: true },

  // disabled = ẩn khỏi danh sách chọn, nhưng thiệp CŨ đang dùng vẫn phát được.
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },

  bytes: { type: DataTypes.BIGINT, allowNull: true },
  duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
  storage_key: { type: DataTypes.STRING(1000), allowNull: true },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  created_by: { type: DataTypes.UUID, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'music_tracks',
  timestamps: false
});

module.exports = MusicTrack;

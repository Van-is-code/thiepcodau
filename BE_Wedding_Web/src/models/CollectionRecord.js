const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Sổ THU HỘ: mỗi đơn đã thanh toán sinh đúng 1 dòng, ghi rõ nền tảng thu hộ CTV bao
// nhiêu và giữ lại bao nhiêu. Dùng để đối soát với sao kê payOS và với sổ ví CTV.
const CollectionRecord = sequelize.define('CollectionRecord', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  // UNIQUE ở DB: 1 đơn chỉ ghi nhận thu hộ đúng 1 lần, kể cả khi webhook gửi lại.
  order_id: { type: DataTypes.UUID, allowNull: false, unique: true },
  ctv_id: { type: DataTypes.UUID, allowNull: true },
  customer_id: { type: DataTypes.UUID, allowNull: true },
  provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'payos' },
  provider_txn_ref: { type: DataTypes.STRING(120), allowNull: true },
  gross_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  platform_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  ctv_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  settlement_status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending_settlement' },
  settled_payout_id: { type: DataTypes.UUID, allowNull: true },
  settled_at: { type: DataTypes.DATE, allowNull: true },
  collected_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'collection_records',
  timestamps: false,
});

module.exports = CollectionRecord;

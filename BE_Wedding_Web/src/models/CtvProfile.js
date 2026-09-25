const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CtvProfile = sequelize.define('CtvProfile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
  user_id: { type: DataTypes.UUID, allowNull: false, unique: true },
  display_name: { type: DataTypes.STRING(150), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  phone: { type: DataTypes.STRING(30), allowNull: true },
  status: { type: DataTypes.ENUM('active', 'locked'), allowNull: false, defaultValue: 'active' },
  single_price: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  combo_price: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  commission_rate: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
  auto_payout_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  auto_payout_weekday: { type: DataTypes.SMALLINT, allowNull: true },
  auto_payout_min_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  bank_name: { type: DataTypes.STRING(120), allowNull: true },
  // Mã BIN ngân hàng (6 số, vd 970422 = MB Bank). Chi hộ payOS cần BIN chứ không
  // nhận tên ngân hàng dạng chữ. Xem src/config/vietqrBanks.js để tra cứu.
  bank_bin: { type: DataTypes.STRING(20), allowNull: true },
  payout_verified_at: { type: DataTypes.DATE, allowNull: true },
  bank_account_number: { type: DataTypes.STRING(60), allowNull: true },
  bank_account_name: { type: DataTypes.STRING(120), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'ctv_profiles',
  timestamps: false
});

module.exports = CtvProfile;

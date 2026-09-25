const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    comment: 'Transaction ID từ SePay'
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Order ID nếu tìm được từ nội dung chuyển khoản'
  },
  gateway: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Tên ngân hàng (gateway)'
  },
  transaction_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Thời gian giao dịch'
  },
  account_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Số tài khoản ngân hàng'
  },
  sub_account: {
    type: DataTypes.STRING(250),
    allowNull: true,
    comment: 'Tài khoản phụ'
  },
  amount_in: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Số tiền vào'
  },
  amount_out: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Số tiền ra'
  },
  accumulated: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Số dư lũy kế'
  },
  code: {
    type: DataTypes.STRING(250),
    allowNull: true,
    comment: 'Mã code thanh toán'
  },
  transaction_content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Nội dung chuyển khoản'
  },
  reference_number: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Mã tham chiếu (reference code)'
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Toàn bộ nội dung tin notify từ ngân hàng'
  },
  status: {
    type: DataTypes.ENUM('success', 'unmatched', 'order_not_found', 'amount_mismatch', 'duplicate_order'),
    allowNull: false,
    defaultValue: 'unmatched',
    comment: 'Trạng thái xử lý giao dịch'
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
  tableName: 'transactions',
  timestamps: false
});

module.exports = Transaction;

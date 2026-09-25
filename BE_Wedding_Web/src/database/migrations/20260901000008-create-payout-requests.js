'use strict';

// Phiếu rút tiền của CTV: thủ công (CTV tạo) hoặc tự động (hệ thống quét theo tuần).
// Admin phê duyệt + tự chuyển khoản. Tiền được "giữ" khỏi ví ngay khi tạo phiếu.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('payout_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      ctv_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'ctv_profiles', key: 'id' }, onDelete: 'CASCADE'
      },
      wallet_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'wallets', key: 'id' }, onDelete: 'CASCADE'
      },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      type: { type: Sequelize.ENUM('manual', 'auto'), allowNull: false, defaultValue: 'manual' },
      status: { type: Sequelize.ENUM('pending', 'approved', 'rejected', 'cancelled'), allowNull: false, defaultValue: 'pending' },
      requested_by: { type: Sequelize.ENUM('ctv', 'system'), allowNull: false, defaultValue: 'ctv' },
      hold_txn_id: { type: Sequelize.UUID, allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      admin_note: { type: Sequelize.TEXT, allowNull: true },
      payment_reference: { type: Sequelize.STRING(120), allowNull: true },
      approved_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      rejected_at: { type: Sequelize.DATE, allowNull: true },
      period_start: { type: Sequelize.DATE, allowNull: true },
      period_end: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('payout_requests', ['ctv_id']);
    await queryInterface.addIndex('payout_requests', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('payout_requests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payout_requests_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payout_requests_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payout_requests_requested_by";');
  }
};

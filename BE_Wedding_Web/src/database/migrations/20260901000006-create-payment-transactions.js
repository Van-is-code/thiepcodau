'use strict';

// Sự kiện thanh toán payOS: idempotency (event_id UNIQUE) + audit.
// Bảng "transactions" cũ (SePay) giữ nguyên, không đụng.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('payment_transactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      order_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE'
      },
      provider: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'payos' },
      event_id: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      provider_txn_ref: { type: Sequelize.STRING(120), allowNull: true },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'succeeded', 'failed'), allowNull: false, defaultValue: 'pending' },
      signature_valid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      raw_payload: { type: Sequelize.JSONB, allowNull: true },
      processed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('payment_transactions', ['order_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('payment_transactions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payment_transactions_status";');
  }
};

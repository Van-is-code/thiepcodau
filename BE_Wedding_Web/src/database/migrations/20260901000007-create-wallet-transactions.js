'use strict';

// Ledger ví CTV (immutable). Bất biến: wallet.balance == SUM(wallet_transactions.amount).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('wallet_transactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      wallet_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'wallets', key: 'id' }, onDelete: 'CASCADE'
      },
      ctv_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'ctv_profiles', key: 'id' }, onDelete: 'CASCADE'
      },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      type: {
        type: Sequelize.ENUM('commission_credit', 'refund_debit', 'payout_hold', 'payout_release', 'adjustment'),
        allowNull: false
      },
      order_id: { type: Sequelize.UUID, allowNull: true },
      payout_request_id: { type: Sequelize.UUID, allowNull: true },
      balance_after: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      note: { type: Sequelize.STRING(255), allowNull: true },
      created_by: { type: Sequelize.ENUM('system', 'admin', 'cron'), allowNull: false, defaultValue: 'system' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('wallet_transactions', ['wallet_id']);
    await queryInterface.addIndex('wallet_transactions', ['ctv_id']);
    await queryInterface.addIndex('wallet_transactions', ['order_id']);
    await queryInterface.addIndex('wallet_transactions', ['payout_request_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('wallet_transactions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wallet_transactions_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wallet_transactions_created_by";');
  }
};

'use strict';

// Hồ sơ CTV (1-1 với users role='ctv') + ví CTV (1-1 với ctv_profiles).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ctv_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      user_id: {
        type: Sequelize.UUID, allowNull: false, unique: true,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE'
      },
      display_name: { type: Sequelize.STRING(150), allowNull: true },
      email: { type: Sequelize.STRING(150), allowNull: true },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      status: { type: Sequelize.ENUM('active', 'locked'), allowNull: false, defaultValue: 'active' },
      single_price: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      combo_price: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      commission_rate: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
      auto_payout_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      auto_payout_weekday: { type: Sequelize.SMALLINT, allowNull: true },
      auto_payout_min_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      bank_name: { type: Sequelize.STRING(120), allowNull: true },
      bank_account_number: { type: Sequelize.STRING(60), allowNull: true },
      bank_account_name: { type: Sequelize.STRING(120), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('ctv_profiles', ['status']);

    await queryInterface.createTable('wallets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      ctv_id: {
        type: Sequelize.UUID, allowNull: false, unique: true,
        references: { model: 'ctv_profiles', key: 'id' }, onDelete: 'CASCADE'
      },
      balance: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      pending_balance: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      total_earned: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      total_paid: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('wallets');
    await queryInterface.dropTable('ctv_profiles');
    // Dọn ENUM type do Postgres tạo ngầm.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ctv_profiles_status";');
  }
};

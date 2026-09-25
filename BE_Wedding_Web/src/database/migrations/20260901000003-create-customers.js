'use strict';

// Tài khoản khách thuộc về 1 CTV. Bọc quanh 1 users row (role='user') để tái dùng
// auth/login + invitationService sẵn có. cards_available LUÔN == users.slot của khách.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('customers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      user_id: {
        type: Sequelize.UUID, allowNull: false, unique: true,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE'
      },
      ctv_id: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'ctv_profiles', key: 'id' }, onDelete: 'SET NULL'
      },
      name: { type: Sequelize.STRING(150), allowNull: true },
      email: { type: Sequelize.STRING(150), allowNull: true },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      status: { type: Sequelize.ENUM('pending_payment', 'active', 'locked'), allowNull: false, defaultValue: 'pending_payment' },
      cards_purchased: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cards_used: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cards_available: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      activated_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('customers', ['ctv_id']);
    await queryInterface.addIndex('customers', ['status']);
    await queryInterface.sequelize.query(
      'ALTER TABLE "customers" ADD CONSTRAINT "customers_cards_available_nonneg" CHECK ("cards_available" >= 0);'
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('customers');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_customers_status";');
  }
};

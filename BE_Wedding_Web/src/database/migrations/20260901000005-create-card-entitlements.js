'use strict';

// Ledger entitlement thiệp (immutable). Nguồn chân lý cho Purchased/Used/Available.
// Các cột cache trên customers rebuild được từ bảng này.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('card_entitlements', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      customer_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'customers', key: 'id' }, onDelete: 'CASCADE'
      },
      order_id: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'orders', key: 'id' }, onDelete: 'SET NULL'
      },
      invitation_id: { type: Sequelize.UUID, allowNull: true },
      delta: { type: Sequelize.INTEGER, allowNull: false },
      reason: { type: Sequelize.ENUM('purchase', 'card_created', 'refund', 'admin_adjust'), allowNull: false },
      purchased_after: { type: Sequelize.INTEGER, allowNull: false },
      used_after: { type: Sequelize.INTEGER, allowNull: false },
      available_after: { type: Sequelize.INTEGER, allowNull: false },
      note: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('card_entitlements', ['customer_id']);
    await queryInterface.addIndex('card_entitlements', ['order_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('card_entitlements');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_card_entitlements_reason";');
  }
};

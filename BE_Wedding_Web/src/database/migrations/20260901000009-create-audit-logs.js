'use strict';

// Nhật ký hành vi: actor / action / entity / old_value / new_value / timestamp.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      actor_type: { type: Sequelize.ENUM('admin', 'ctv', 'system', 'customer'), allowNull: false },
      actor_id: { type: Sequelize.UUID, allowNull: true },
      action: { type: Sequelize.STRING(60), allowNull: false },
      entity_type: { type: Sequelize.STRING(40), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      old_value: { type: Sequelize.JSONB, allowNull: true },
      new_value: { type: Sequelize.JSONB, allowNull: true },
      ip: { type: Sequelize.STRING(60), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['actor_type', 'actor_id']);
    await queryInterface.addIndex('audit_logs', ['action']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('audit_logs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_audit_logs_actor_type";');
  }
};

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('invitation_templates', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'draft'
    });

    await queryInterface.addColumn('invitation_templates', 'schema', {
      type: Sequelize.JSONB,
      allowNull: true
    });

    await queryInterface.addColumn('invitations', 'extra_data', {
      type: Sequelize.JSONB,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('invitations', 'extra_data');
    await queryInterface.removeColumn('invitation_templates', 'schema');
    await queryInterface.removeColumn('invitation_templates', 'status');
  }
};

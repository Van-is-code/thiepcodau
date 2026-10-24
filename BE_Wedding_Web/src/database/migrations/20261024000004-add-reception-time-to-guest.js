'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('guest');
    if (!table.reception_time) {
      await queryInterface.addColumn('guest', 'reception_time', {
        type: Sequelize.STRING(30),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('guest');
    if (table.reception_time) {
      await queryInterface.removeColumn('guest', 'reception_time');
    }
  }
};

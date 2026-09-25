'use strict';

const { randomUUID } = require('crypto');

// 2 sản phẩm gốc + bảng cấu hình toàn cục.
// products: giá sàn (base_price) do admin quy định. CTV không bán thấp hơn.
//   - single: 1 thiệp / 1 tài khoản khách, sàn 200.000
//   - combo : 2 thiệp / 1 tài khoản khách, sàn 300.000
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('products', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      card_quantity: { type: Sequelize.INTEGER, allowNull: false },
      base_price: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('app_settings', {
      key: { type: Sequelize.STRING(60), primaryKey: true, allowNull: false },
      value: { type: Sequelize.JSONB, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    const now = new Date();
    await queryInterface.bulkInsert('products', [
      { id: randomUUID(), code: 'single', name: 'Thiệp lẻ', card_quantity: 1, base_price: 200000, active: true, created_at: now, updated_at: now },
      { id: randomUUID(), code: 'combo', name: 'Combo 2 thiệp', card_quantity: 2, base_price: 300000, active: true, created_at: now, updated_at: now }
    ]);

    await queryInterface.bulkInsert('app_settings', [
      { key: 'auto_payout', value: JSON.stringify({ default_weekday: 1, run_hour: 9, last_run_date: null }), updated_at: now }
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('app_settings');
    await queryInterface.dropTable('products');
  }
};

'use strict';

// MỞ RỘNG bảng orders sẵn có cho luồng CTV (không tạo bảng song song).
// Mọi cột thêm đều nullable -> backward compatible với đơn SePay cũ.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const cols = {
      kind: { type: Sequelize.ENUM('legacy_slot', 'ctv'), allowNull: false, defaultValue: 'legacy_slot' },
      ctv_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'ctv_profiles', key: 'id' }, onDelete: 'SET NULL' },
      customer_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'customers', key: 'id' }, onDelete: 'SET NULL' },
      product_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'products', key: 'id' }, onDelete: 'SET NULL' },
      product_code: { type: Sequelize.STRING(20), allowNull: true },
      card_quantity: { type: Sequelize.INTEGER, allowNull: true },
      admin_base_price: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      ctv_selling_price: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      commission_rate: { type: Sequelize.DECIMAL(5, 4), allowNull: true },
      commission_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      ctv_earning_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      payment_provider: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'payos' },
      payos_order_code: { type: Sequelize.BIGINT, allowNull: true, unique: true },
      payos_payment_link_id: { type: Sequelize.STRING(64), allowNull: true },
      payos_checkout_url: { type: Sequelize.STRING(500), allowNull: true },
      payos_qr: { type: Sequelize.TEXT, allowNull: true },
      order_token: { type: Sequelize.UUID, allowNull: true, unique: true },
      expired_at: { type: Sequelize.DATE, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true }
    };

    for (const [name, spec] of Object.entries(cols)) {
      await queryInterface.addColumn('orders', name, spec);
    }

    await queryInterface.addIndex('orders', ['ctv_id']);
    await queryInterface.addIndex('orders', ['customer_id']);
    await queryInterface.addIndex('orders', ['kind']);

    // Mở rộng ENUM trạng thái đơn: pending|paid|cancelled -> + expired|refunded.
    // ADD VALUE không chạy trong transaction (Postgres) -> chạy rời từng lệnh.
    await queryInterface.sequelize.query('ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS \'expired\';');
    await queryInterface.sequelize.query('ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS \'refunded\';');
  },

  down: async (queryInterface) => {
    for (const name of [
      'kind', 'ctv_id', 'customer_id', 'product_id', 'product_code', 'card_quantity',
      'admin_base_price', 'ctv_selling_price', 'commission_rate', 'commission_amount',
      'ctv_earning_amount', 'payment_provider', 'payos_order_code', 'payos_payment_link_id',
      'payos_checkout_url', 'payos_qr', 'order_token', 'expired_at', 'paid_at'
    ]) {
      await queryInterface.removeColumn('orders', name).catch(() => {});
    }
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_kind";');
    // Không thu hồi giá trị enum 'expired'/'refunded' (Postgres không hỗ trợ DROP VALUE).
  }
};

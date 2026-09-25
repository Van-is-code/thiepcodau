'use strict';

// Dữ liệu demo cho luồng CTV (chỉ chạy khi npm run db:seed). Không dùng ở production.
//   CTV : ctv1 / ctv12345   (single 220.000, combo 330.000, hoa hồng 40%)
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const CTV_USER_ID = '33333333-3333-3333-3333-333333333333';
const CTV_PROFILE_ID = '44444444-4444-4444-4444-444444444444';
const WALLET_ID = '55555555-5555-5555-5555-555555555555';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const password = await bcrypt.hash('ctv12345', 10);

    await queryInterface.bulkInsert('users', [{
      id: CTV_USER_ID, username: 'ctv1', password, role: 'ctv', slot: 0, created_at: now, updated_at: now
    }]);

    await queryInterface.bulkInsert('ctv_profiles', [{
      id: CTV_PROFILE_ID, user_id: CTV_USER_ID,
      display_name: 'CTV Demo', email: 'ctv1@example.com', phone: '0900000000',
      status: 'active', single_price: 220000, combo_price: 330000, commission_rate: 0.4,
      auto_payout_enabled: false, auto_payout_weekday: 1, auto_payout_min_amount: 100000,
      bank_name: 'MB Bank', bank_account_number: '0900000000', bank_account_name: 'CTV DEMO',
      created_at: now, updated_at: now
    }]);

    await queryInterface.bulkInsert('wallets', [{
      id: WALLET_ID, ctv_id: CTV_PROFILE_ID,
      balance: 0, pending_balance: 0, total_earned: 0, total_paid: 0, updated_at: now
    }]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('wallets', { id: WALLET_ID });
    await queryInterface.bulkDelete('ctv_profiles', { id: CTV_PROFILE_ID });
    await queryInterface.bulkDelete('users', { id: CTV_USER_ID });
  }
};

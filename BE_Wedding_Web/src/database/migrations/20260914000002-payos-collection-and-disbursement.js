'use strict';

// Thu hộ & chi hộ payOS.
//
// CHI HỘ (payout): phiếu rút được chuyển khoản TỰ ĐỘNG qua payOS Payouts thay vì
// admin bấm chuyển tay. Cần lưu id lệnh chi bên payOS + trạng thái để đối soát và
// để lệnh không bao giờ được gửi hai lần.
//
// THU HỘ (collection): mỗi đơn ghi rõ nền tảng thu HỘ CTV bao nhiêu, phần nào là
// doanh thu nền tảng — phục vụ đối soát và báo cáo thuế.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const payout = await queryInterface.describeTable('payout_requests');
    const addPayout = async (name, spec) => {
      if (!payout[name]) await queryInterface.addColumn('payout_requests', name, spec);
    };

    // 'manual' = admin tự chuyển khoản; 'payos' = chi hộ tự động qua payOS.
    await addPayout('provider', { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'manual' });
    await addPayout('provider_payout_id', { type: Sequelize.STRING(120), allowNull: true });
    // processing | succeeded | failed
    await addPayout('provider_state', { type: Sequelize.STRING(20), allowNull: true });
    await addPayout('provider_reference', { type: Sequelize.STRING(120), allowNull: true });
    await addPayout('failure_reason', { type: Sequelize.TEXT, allowNull: true });
    // Ảnh chụp thông tin ngân hàng TẠI THỜI ĐIỂM duyệt: CTV đổi số tài khoản sau đó
    // cũng không làm sai lệch hồ sơ đã chi.
    await addPayout('bank_snapshot', { type: Sequelize.JSONB, allowNull: true });
    await addPayout('provider_payload', { type: Sequelize.JSONB, allowNull: true });
    await addPayout('disbursed_at', { type: Sequelize.DATE, allowNull: true });

    // UNIQUE: chốt chặn ở tầng DB — 1 phiếu rút không thể gắn 2 lệnh chi khác nhau,
    // và cùng 1 lệnh chi không thể bị ghi cho 2 phiếu.
    await queryInterface.addIndex('payout_requests', ['provider_payout_id'], {
      name: 'payout_requests_provider_payout_id_uniq',
      unique: true,
      where: { provider_payout_id: { [Sequelize.Op.ne]: null } },
    }).catch(() => {});

    // CTV cần mã BIN ngân hàng để chi hộ (tên ngân hàng dạng chữ không dùng được).
    const ctv = await queryInterface.describeTable('ctv_profiles');
    if (!ctv.bank_bin) {
      await queryInterface.addColumn('ctv_profiles', 'bank_bin', { type: Sequelize.STRING(20), allowNull: true });
    }
    if (!ctv.payout_verified_at) {
      await queryInterface.addColumn('ctv_profiles', 'payout_verified_at', { type: Sequelize.DATE, allowNull: true });
    }

    // ----- Sổ thu hộ: mỗi đơn PAID sinh 1 dòng -----
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!names.includes('collection_records')) {
      await queryInterface.createTable('collection_records', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        order_id: {
          type: Sequelize.UUID, allowNull: false, unique: true,
          references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE',
        },
        ctv_id: {
          type: Sequelize.UUID, allowNull: true,
          references: { model: 'ctv_profiles', key: 'id' }, onDelete: 'SET NULL',
        },
        customer_id: { type: Sequelize.UUID, allowNull: true },
        provider: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'payos' },
        provider_txn_ref: { type: Sequelize.STRING(120), allowNull: true },
        // Tổng tiền khách trả vào tài khoản nền tảng.
        gross_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
        // Phần nền tảng giữ lại (hoa hồng nền tảng).
        platform_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        // Phần thu HỘ cho CTV — sẽ được chi hộ lại qua phiếu rút.
        ctv_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
        // pending_settlement (chưa chi cho CTV) | settled (đã nằm trong 1 phiếu rút đã chi)
        settlement_status: { type: Sequelize.STRING(24), allowNull: false, defaultValue: 'pending_settlement' },
        settled_payout_id: { type: Sequelize.UUID, allowNull: true },
        settled_at: { type: Sequelize.DATE, allowNull: true },
        collected_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await queryInterface.addIndex('collection_records', ['ctv_id']);
      await queryInterface.addIndex('collection_records', ['settlement_status']);
      await queryInterface.addIndex('collection_records', ['collected_at']);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('collection_records').catch(() => {});
    await queryInterface.removeIndex('payout_requests', 'payout_requests_provider_payout_id_uniq').catch(() => {});
    for (const c of ['provider', 'provider_payout_id', 'provider_state', 'provider_reference',
      'failure_reason', 'bank_snapshot', 'provider_payload', 'disbursed_at']) {
      await queryInterface.removeColumn('payout_requests', c).catch(() => {});
    }
    for (const c of ['bank_bin', 'payout_verified_at']) {
      await queryInterface.removeColumn('ctv_profiles', c).catch(() => {});
    }
  },
};

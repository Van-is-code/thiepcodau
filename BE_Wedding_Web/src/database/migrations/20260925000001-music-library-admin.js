'use strict';

// Kho nhạc: từ "một bảng phẳng ai cũng thấy hết" thành có chủ, có bật/tắt, có
// giới hạn riêng cho từng khách — giống cách mẫu thiệp đang làm.
module.exports = {
  async up(queryInterface, Sequelize) {
    const bang = await queryInterface.describeTable('music_tracks');
    const them = async (ten, dinhNghia) => {
      if (!bang[ten]) await queryInterface.addColumn('music_tracks', ten, dinhNghia);
    };

    // public = mọi khách chọn được; exclusive = chỉ đúng 1 khách hàng.
    await them('visibility', {
      type: Sequelize.STRING(20), allowNull: false, defaultValue: 'public',
    });
    await them('owner_customer_id', {
      type: Sequelize.UUID, allowNull: true,
      references: { model: 'customers', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'SET NULL',
    });

    // active = khách chọn được; disabled = ẩn khỏi danh sách nhưng THIỆP CŨ VẪN
    // PHÁT ĐƯỢC. Xoá hẳn mới làm hỏng thiệp đã dùng bài đó.
    await them('status', {
      type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active',
    });

    await them('artist', { type: Sequelize.STRING(255), allowNull: true });
    await them('bytes', { type: Sequelize.BIGINT, allowNull: true });
    await them('duration_seconds', { type: Sequelize.INTEGER, allowNull: true });
    await them('storage_key', { type: Sequelize.STRING(1000), allowNull: true });
    await them('sort_order', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await them('created_by', { type: Sequelize.UUID, allowNull: true });
    await them('updated_at', { type: Sequelize.DATE, allowNull: true });

    await queryInterface.addIndex('music_tracks', ['status', 'visibility'], {
      name: 'music_tracks_status_visibility_idx',
    }).catch(() => {});
    await queryInterface.addIndex('music_tracks', ['owner_customer_id'], {
      name: 'music_tracks_owner_idx',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('music_tracks', 'music_tracks_status_visibility_idx').catch(() => {});
    await queryInterface.removeIndex('music_tracks', 'music_tracks_owner_idx').catch(() => {});
    for (const c of ['visibility', 'owner_customer_id', 'status', 'artist', 'bytes',
      'duration_seconds', 'storage_key', 'sort_order', 'created_by', 'updated_at']) {
      await queryInterface.removeColumn('music_tracks', c).catch(() => {});
    }
  },
};

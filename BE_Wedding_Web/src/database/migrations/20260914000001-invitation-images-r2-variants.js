'use strict';

// Ảnh thiệp chuyển sang Cloudflare R2 + nhiều phiên bản kích thước.
//
// - storage_driver/storage_key : biết ảnh nằm ở R2 hay đĩa local để xoá đúng chỗ
// - variants (JSONB)           : danh sách cỡ/định dạng cho srcset (avif/webp/jpeg)
// - blur_data_url              : ảnh nhoè siêu nhỏ, hiện ngay khi chưa tải xong ảnh thật
// - dominant_color             : màu nền ô ảnh, tránh nháy trắng
// - width/height               : để đặt aspect-ratio, chống giật bố cục (CLS)
//
// Toàn bộ cột đều nullable -> ảnh cũ đã lưu vẫn dùng bình thường qua image_url.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('invitation_images');
    const add = async (name, spec) => {
      if (!table[name]) await queryInterface.addColumn('invitation_images', name, spec);
    };

    await add('storage_driver', { type: Sequelize.STRING(16), allowNull: true });
    await add('storage_key', { type: Sequelize.STRING(500), allowNull: true });
    await add('width', { type: Sequelize.INTEGER, allowNull: true });
    await add('height', { type: Sequelize.INTEGER, allowNull: true });
    await add('bytes', { type: Sequelize.INTEGER, allowNull: true });
    await add('blur_data_url', { type: Sequelize.TEXT, allowNull: true });
    await add('dominant_color', { type: Sequelize.STRING(16), allowNull: true });
    await add('variants', { type: Sequelize.JSONB, allowNull: true });
    await add('updated_at', { type: Sequelize.DATE, allowNull: true });

    // Truy vấn nóng nhất khi khách mở thiệp: lấy ảnh của 1 thiệp theo đúng thứ tự.
    const indexes = await queryInterface.showIndex('invitation_images').catch(() => []);
    const names = indexes.map((i) => i.name);
    if (!names.includes('invitation_images_invitation_id_sort_order')) {
      await queryInterface.addIndex('invitation_images', ['invitation_id', 'sort_order'], {
        name: 'invitation_images_invitation_id_sort_order',
      });
    }
    if (!names.includes('invitation_images_users_id')) {
      await queryInterface.addIndex('invitation_images', ['users_id'], {
        name: 'invitation_images_users_id',
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('invitation_images', 'invitation_images_invitation_id_sort_order').catch(() => {});
    await queryInterface.removeIndex('invitation_images', 'invitation_images_users_id').catch(() => {});
    for (const c of ['storage_driver', 'storage_key', 'width', 'height', 'bytes', 'blur_data_url', 'dominant_color', 'variants', 'updated_at']) {
      await queryInterface.removeColumn('invitation_images', c).catch(() => {});
    }
  },
};

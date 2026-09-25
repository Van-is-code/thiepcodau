'use strict';

// Admin tự chọn NGƯỜI DÙNG được sửa những gì trên mỗi mẫu.
//
// Vì sao cần: không phải mẫu nào cũng muốn cho khách sửa mọi thứ. Có mẫu thiết kế
// chữ lồng và nhãn theo bố cục riêng — khách gõ dài ra là vỡ layout. Có mẫu album
// chỉ đẹp với đúng 6 ảnh. Trước đây hễ gắn data-field là khách sửa được tất.
//
//   editable_fields : danh sách khoá trường khách được sửa tại chỗ.
//                     null = dùng bộ MẶC ĐỊNH (tên, ngày, địa chỉ, lời cảm ơn...).
//                     []   = khoá hết, khách chỉ xem.
//   image_slot_rules: giới hạn từng ô ảnh, vd { gallery: { max: 12, allow_add: true } }
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.describeTable('invitation_templates');
    if (!t.editable_fields) {
      await queryInterface.addColumn('invitation_templates', 'editable_fields', {
        type: Sequelize.JSONB, allowNull: true,
      });
    }
    if (!t.image_slot_rules) {
      await queryInterface.addColumn('invitation_templates', 'image_slot_rules', {
        type: Sequelize.JSONB, allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    for (const c of ['editable_fields', 'image_slot_rules']) {
      await queryInterface.removeColumn('invitation_templates', c).catch(() => {});
    }
  },
};

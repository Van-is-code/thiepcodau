'use strict';

// Không phải mẫu thiệp nào cũng có hộp nhạc: mẫu tối giản thường không có thẻ
// <audio> nào. Trước đây hệ thống cứ gán music_url cho mọi thiệp, mẫu không có
// hộp nhạc thì giá trị đó nằm không — khách vẫn thấy ô chọn nhạc rồi thắc mắc
// sao chọn xong không nghe thấy gì.
//
// has_music_box: null = chưa xác định (suy từ manifest lúc đọc),
//                true/false = admin đã chốt bằng tay.
module.exports = {
  async up(queryInterface, Sequelize) {
    const bang = await queryInterface.describeTable('invitation_templates');
    if (!bang.has_music_box) {
      await queryInterface.addColumn('invitation_templates', 'has_music_box', {
        type: Sequelize.BOOLEAN, allowNull: true, defaultValue: null,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('invitation_templates', 'has_music_box').catch(() => {});
  },
};

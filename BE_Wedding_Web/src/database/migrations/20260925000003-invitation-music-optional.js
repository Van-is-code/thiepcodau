'use strict';

/**
 * Cho phép cột music_url trong bảng invitations là NULL hoặc rỗng.
 * Người dùng có thể chỉ tải file ghi âm lời chúc mà không chọn nhạc nền,
 * hoặc mẫu thiệp không có hộp nhạc thì music_url không bắt buộc phải có giá trị.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query('ALTER TABLE invitations ALTER COLUMN music_url DROP NOT NULL;');
      await queryInterface.sequelize.query("ALTER TABLE invitations ALTER COLUMN music_url SET DEFAULT '';");
    } catch (_e) {
      await queryInterface.changeColumn('invitations', 'music_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: '',
      }).catch(() => {});
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query("UPDATE invitations SET music_url = '' WHERE music_url IS NULL;");
      await queryInterface.sequelize.query('ALTER TABLE invitations ALTER COLUMN music_url SET NOT NULL;');
    } catch (_e) {
      await queryInterface.changeColumn('invitations', 'music_url', {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: '',
      }).catch(() => {});
    }
  },
};

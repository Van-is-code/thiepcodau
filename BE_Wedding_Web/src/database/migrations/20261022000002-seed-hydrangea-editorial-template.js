'use strict';

/**
 * Đăng ký mẫu thiệp cưới cao cấp "Hydrangea Editorial" (theme_hydrangea_editorial)
 * vào bảng invitation_templates với cấu hình:
 * - status: 'published'
 * - visibility: 'public'
 * - has_music_box: true
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const templateId = 'c7b89a01-3456-4abc-9def-0123456789ab';

    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM invitation_templates WHERE template_code = 'theme_hydrangea_editorial' LIMIT 1;`
    );

    if (existing && existing.length > 0) {
      await queryInterface.sequelize.query(`
        UPDATE invitation_templates
        SET
          template_name = 'Hydrangea Editorial',
          html_path = '/templates/theme_hydrangea_editorial/index.html',
          has_music_box = true,
          status = 'published',
          visibility = 'public',
          thumbnail_url = '/templates/theme_hydrangea_editorial/assets/images/52ed9a3f-608e-403c-98a9-9cf73747e2a8.jpg',
          description = 'Mẫu thiệp cưới phong cách Editorial - Bồ câu đưa thư mở phong bì nghệ thuật, tone màu oải hương Lavender & Cẩm tú cầu Hydrangea, kết nối âm nhạc, album ảnh, đếm ngược và RSVP xác nhận.',
          sort_order = 2,
          updated_at = NOW()
        WHERE template_code = 'theme_hydrangea_editorial';
      `);
    } else {
      await queryInterface.sequelize.query(`
        INSERT INTO invitation_templates (
          id,
          template_code,
          template_name,
          html_path,
          has_music_box,
          status,
          visibility,
          thumbnail_url,
          description,
          sort_order,
          created_at,
          updated_at
        ) VALUES (
          '${templateId}',
          'theme_hydrangea_editorial',
          'Hydrangea Editorial',
          '/templates/theme_hydrangea_editorial/index.html',
          true,
          'published',
          'public',
          '/templates/theme_hydrangea_editorial/assets/images/52ed9a3f-608e-403c-98a9-9cf73747e2a8.jpg',
          'Mẫu thiệp cưới phong cách Editorial - Bồ câu đưa thư mở phong bì nghệ thuật, tone màu oải hương Lavender & Cẩm tú cầu Hydrangea, kết nối âm nhạc, album ảnh, đếm ngược và RSVP xác nhận.',
          2,
          NOW(),
          NOW()
        );
      `);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE invitation_templates
      SET status = 'draft', updated_at = NOW()
      WHERE template_code = 'theme_hydrangea_editorial';
    `).catch(() => {});
  }
};

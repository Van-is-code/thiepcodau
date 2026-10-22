'use strict';

/**
 * Đăng ký / chuẩn hoá mẫu thiệp cưới cao cấp "Blue Botanical" (theme_blue_botanical_masterpiece)
 * vào bảng invitation_templates với cấu hình:
 * - status: 'published'
 * - visibility: 'public'
 * - html_path: '/templates/theme_blue_botanical_masterpiece/index.html'
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const templateId = 'fb55c2e3-7b11-4f40-8656-62d68a8f192a';

    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM invitation_templates WHERE template_code = 'theme_blue_botanical_masterpiece' OR id = '${templateId}' LIMIT 1;`
    );

    if (existing && existing.length > 0) {
      await queryInterface.sequelize.query(`
        UPDATE invitation_templates
        SET
          template_code = 'theme_blue_botanical_masterpiece',
          template_name = 'Blue Botanical',
          html_path = '/templates/theme_blue_botanical_masterpiece/index.html',
          has_music_box = COALESCE(has_music_box, false),
          status = 'published',
          visibility = 'public',
          thumbnail_url = COALESCE(thumbnail_url, '/templates/theme_blue_botanical_masterpiece/assets/images/couple/52ed9a3f-608e-403c-98a9-9cf73747e2a8.jpg'),
          description = COALESCE(description, 'Mẫu thiệp cưới kỹ thuật số Blue Botanical phong cách hoa màu nước, giấy mỹ thuật cổ điển, máy đĩa than & Voice Note.'),
          updated_at = NOW()
        WHERE id = '${existing[0].id}';
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
          'theme_blue_botanical_masterpiece',
          'Blue Botanical',
          '/templates/theme_blue_botanical_masterpiece/index.html',
          false,
          'published',
          'public',
          '/templates/theme_blue_botanical_masterpiece/assets/images/couple/52ed9a3f-608e-403c-98a9-9cf73747e2a8.jpg',
          'Mẫu thiệp cưới kỹ thuật số Blue Botanical phong cách hoa màu nước, giấy mỹ thuật cổ điển, máy đĩa than & Voice Note.',
          1,
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
      WHERE template_code = 'theme_blue_botanical_masterpiece';
    `).catch(() => {});
  }
};

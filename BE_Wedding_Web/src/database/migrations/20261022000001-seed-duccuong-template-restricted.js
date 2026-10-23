'use strict';

/**
 * Đăng ký mẫu thiệp cưới kinh điển "Đức Cương & Nguyễn Quyết" (duccuong-nguyenquyet)
 * vào bảng invitation_templates với cấu hình:
 * - status: 'published'
 * - visibility: 'restricted' (chỉ tài khoản nào admin cấp quyền mới được dùng)
 * - has_music_box: true
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const templateId = 'b8e7215c-1e8f-4a0b-99f2-2bce811c7501';

    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM invitation_templates WHERE template_code = 'duccuong-nguyenquyet' LIMIT 1;`
    );

    if (existing && existing.length > 0) {
      await queryInterface.sequelize.query(`
        UPDATE invitation_templates
        SET
          template_name = 'Đức Cương & Nguyễn Quyết',
          html_path = '/templates/duccuong-nguyenquyet/www.ziuwedding.site/vobe2.html',
          schema = '{"editHtmlPath": "/templates/duccuong-nguyenquyet/www.ziuwedding.site/phongbibe2.html"}',
          has_music_box = true,
          status = 'published',
          visibility = 'restricted',
          thumbnail_url = '/templates/duccuong-nguyenquyet/www.ziuwedding.site/images/codau.png',
          description = 'Mẫu thiệp cưới kinh điển LadiPage - Bìa phong bì mở ra thiệp, tích hợp album ảnh, hộp nhạc, đếm ngược ngày cưới, mừng cưới QR và RSVP.',
          sort_order = 1,
          updated_at = NOW()
        WHERE template_code = 'duccuong-nguyenquyet';
      `);
    } else {
      await queryInterface.sequelize.query(`
        INSERT INTO invitation_templates (
          id,
          template_code,
          template_name,
          html_path,
          schema,
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
          'duccuong-nguyenquyet',
          'Đức Cương & Nguyễn Quyết',
          '/templates/duccuong-nguyenquyet/www.ziuwedding.site/vobe2.html',
          '{"editHtmlPath": "/templates/duccuong-nguyenquyet/www.ziuwedding.site/phongbibe2.html"}',
          true,
          'published',
          'restricted',
          '/templates/duccuong-nguyenquyet/www.ziuwedding.site/images/codau.png',
          'Mẫu thiệp cưới kinh điển LadiPage - Bìa phong bì mở ra thiệp, tích hợp album ảnh, hộp nhạc, đếm ngược ngày cưới, mừng cưới QR và RSVP.',
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
      WHERE template_code = 'duccuong-nguyenquyet';
    `).catch(() => {});
  }
};

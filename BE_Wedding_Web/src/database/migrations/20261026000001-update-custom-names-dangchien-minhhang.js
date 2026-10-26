'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [invs] = await queryInterface.sequelize.query(`
      SELECT i.id, i.groom_id, i.bride_id, i.invitation_slug, i.extra_data
      FROM invitations i
      WHERE i.id = 'f432293b-6bac-4731-94b2-8509a05957cb' OR i.invitation_slug = 'minhhang-dangchien'
      LIMIT 1;
    `);

    if (invs && invs.length > 0) {
      const inv = invs[0];
      const invId = inv.id;

      // 1. Cập nhật extra_data với custom groom_short_name, bride_short_name, couple_names
      let extra = typeof inv.extra_data === 'string' ? JSON.parse(inv.extra_data || '{}') : (inv.extra_data || {});
      extra.groom_short_name = 'Đăng Chiến';
      extra.bride_short_name = 'Minh Hằng';
      extra.couple_names = 'Đăng Chiến & Minh Hằng';

      await queryInterface.sequelize.query(`
        UPDATE invitations
        SET extra_data = :extraJson::jsonb,
            updated_at = NOW()
        WHERE id = :invId;
      `, {
        replacements: { extraJson: JSON.stringify(extra), invId }
      });

      // 2. Viết hoa chuẩn cho tên chú rể và cô dâu
      if (inv.groom_id) {
        await queryInterface.sequelize.query(`
          UPDATE grooms
          SET name_groom = 'Đăng Chiến'
          WHERE id = :groomId;
        `, {
          replacements: { groomId: inv.groom_id }
        });
      }

      if (inv.bride_id) {
        await queryInterface.sequelize.query(`
          UPDATE brides
          SET name_bride = 'Minh Hằng'
          WHERE id = :brideId;
        `, {
          replacements: { brideId: inv.bride_id }
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
  }
};

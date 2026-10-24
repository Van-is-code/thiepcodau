'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Tìm thiệp của user chienhang (hoặc id = '93392fc2-101b-4fcc-a589-119dc8e1154d')
    const [invs] = await queryInterface.sequelize.query(`
      SELECT i.id, i.invitation_slug, u.username 
      FROM invitations i
      LEFT JOIN users u ON i.users_id = u.id
      WHERE u.username = 'chienhang' OR i.id = '93392fc2-101b-4fcc-a589-119dc8e1154d'
      LIMIT 1;
    `);

    if (invs && invs.length > 0) {
      const invId = invs[0].id;
      const newSlug = 'dangchien-minhhang';

      // 1. Cập nhật invitations
      await queryInterface.sequelize.query(`
        UPDATE invitations
        SET invitation_slug = :newSlug,
            extra_data = jsonb_set(COALESCE(extra_data, '{}'::jsonb), '{slug_customized}', 'true'::jsonb),
            updated_at = NOW()
        WHERE id = :invId;
      `, {
        replacements: { newSlug, invId }
      });

      // 2. Cập nhật private_invitation links cho thiệp này
      await queryInterface.sequelize.query(`
        UPDATE private_invitation
        SET url = '/' || :newSlug || '?g=' || SUBSTRING(REPLACE(guest_id::text, '-', ''), 1, 8),
            updated_at = NOW()
        WHERE invitationns_id = :invId;
      `, {
        replacements: { newSlug, invId }
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Không cần revert bắt buộc
  }
};

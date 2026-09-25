'use strict';

// Phân quyền mẫu thiệp.
//
// Ba mức hiển thị:
//   public    — mọi CTV / khách đều dùng được (mặc định, giữ nguyên hành vi cũ)
//   restricted— chỉ những ai được cấp quyền trong template_permissions
//   exclusive — độc quyền cho ĐÚNG một khách hàng (owner_customer_id)
//
// Bảng template_permissions là danh sách cấp quyền chi tiết: cấp cho 1 CTV (khi đó
// mọi khách của CTV đó dùng được), hoặc cấp thẳng cho 1 khách / 1 tài khoản.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.describeTable('invitation_templates');
    const add = async (name, spec) => {
      if (!t[name]) await queryInterface.addColumn('invitation_templates', name, spec);
    };

    await add('visibility', { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'public' });
    await add('owner_customer_id', {
      type: Sequelize.UUID, allowNull: true,
      references: { model: 'customers', key: 'id' }, onDelete: 'SET NULL',
    });
    await add('created_by', {
      type: Sequelize.UUID, allowNull: true,
      references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
    });
    await add('thumbnail_url', { type: Sequelize.STRING(500), allowNull: true });
    await add('description', { type: Sequelize.TEXT, allowNull: true });
    // Manifest do bộ chuyển đổi sinh ra: mẫu hỗ trợ trường nào, ô ảnh nào.
    await add('manifest', { type: Sequelize.JSONB, allowNull: true });
    await add('sort_order', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await add('updated_at', { type: Sequelize.DATE, allowNull: true });

    await queryInterface.addIndex('invitation_templates', ['visibility'], {
      name: 'invitation_templates_visibility',
    }).catch(() => {});
    await queryInterface.addIndex('invitation_templates', ['owner_customer_id'], {
      name: 'invitation_templates_owner_customer',
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('invitation_templates', 'invitation_templates_visibility').catch(() => {});
    await queryInterface.removeIndex('invitation_templates', 'invitation_templates_owner_customer').catch(() => {});
    for (const c of ['visibility', 'owner_customer_id', 'created_by', 'thumbnail_url',
      'description', 'manifest', 'sort_order', 'updated_at']) {
      await queryInterface.removeColumn('invitation_templates', c).catch(() => {});
    }
  },
};

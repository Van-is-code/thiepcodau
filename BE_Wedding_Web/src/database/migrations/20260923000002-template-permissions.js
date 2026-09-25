'use strict';

// Danh sách cấp quyền dùng mẫu.
//
// grantee_type:
//   'ctv'      — cấp cho 1 cộng tác viên; mọi khách của CTV đó dùng được mẫu
//   'customer' — cấp thẳng cho 1 khách hàng cụ thể
//   'user'     — cấp cho 1 tài khoản (khách tự phục vụ, không qua CTV)
//
// Không dùng khoá ngoại cho grantee_id vì nó trỏ tới 3 bảng khác nhau tuỳ loại;
// bù lại có ràng buộc UNIQUE để không cấp trùng, và service luôn kiểm tồn tại.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (names.includes('template_permissions')) return;

    await queryInterface.createTable('template_permissions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      template_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'invitation_templates', key: 'id' }, onDelete: 'CASCADE',
      },
      grantee_type: { type: Sequelize.STRING(16), allowNull: false },
      grantee_id: { type: Sequelize.UUID, allowNull: false },
      // Tắt tạm quyền mà không cần xoá dòng -> giữ được lịch sử ai từng được cấp.
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      granted_by: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'users', key: 'id' }, onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('template_permissions', ['template_id']);
    await queryInterface.addIndex('template_permissions', ['grantee_type', 'grantee_id']);
    // Một đối tượng chỉ được cấp quyền 1 lần cho 1 mẫu.
    await queryInterface.addConstraint('template_permissions', {
      fields: ['template_id', 'grantee_type', 'grantee_id'],
      type: 'unique',
      name: 'template_permissions_unique_grant',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('template_permissions').catch(() => {});
  },
};

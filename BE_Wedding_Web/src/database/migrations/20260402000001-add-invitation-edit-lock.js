'use strict';

// Cơ chế giới hạn sửa thiệp + khoá sau ngày cưới.
// - edit_count: số lần bấm "Lưu" trong trình sửa (mỗi lần lưu = 1, không tính đổi mẫu).
// - edit_deadline: hạn cuối được sửa = ngày cưới GỐC + 3 ngày. Set 1 lần khi user
//   chọn ngày cưới lần đầu, KHÔNG đổi khi user sửa lại ngày sau đó.
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('invitations', 'edit_count', {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0
		});
		await queryInterface.addColumn('invitations', 'edit_deadline', {
			type: Sequelize.DATE,
			allowNull: true
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn('invitations', 'edit_deadline');
		await queryInterface.removeColumn('invitations', 'edit_count');
	}
};

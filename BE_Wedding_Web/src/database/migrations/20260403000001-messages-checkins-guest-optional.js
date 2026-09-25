'use strict';

// Khách vào bằng link CHUNG (không có ?guest=...) vẫn gửi được xác nhận tham dự.
// Trước đây guest_id NOT NULL -> RSVP từ link chung bị 500. Cho phép NULL.
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn('messages_checkins', 'guest_id', {
			type: Sequelize.UUID,
			allowNull: true
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn('messages_checkins', 'guest_id', {
			type: Sequelize.UUID,
			allowNull: false
		});
	}
};

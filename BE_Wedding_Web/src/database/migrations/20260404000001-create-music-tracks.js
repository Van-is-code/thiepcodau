'use strict';

// Kho nhạc dùng chung: admin tải file mp3 lên hoặc dán link nhạc.
// Khách chọn nhạc cho thiệp từ kho này (hoặc tự dán link riêng).
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('music_tracks', {
			id: {
				type: Sequelize.UUID,
				defaultValue: Sequelize.UUIDV4,
				primaryKey: true,
				allowNull: false
			},
			title: { type: Sequelize.STRING(255), allowNull: false },
			url: { type: Sequelize.STRING(1000), allowNull: false },
			source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'link' }, // 'file' | 'link'
			created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
		});
	},

	down: async (queryInterface) => {
		await queryInterface.dropTable('music_tracks');
	}
};

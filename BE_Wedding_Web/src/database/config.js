// Cấu hình kết nối DB cho cả Sequelize CLI (migrate/seed) và app runtime (config/db.js).
// Đọc từ biến môi trường để Docker Compose (hoặc bất kỳ môi trường nào khác) có thể trỏ
// DB_HOST sang tên service (vd: "db") thay vì "localhost". Không set biến môi trường thì
// giữ nguyên giá trị mặc định như trước đây (chạy local không cần đổi gì).
require('dotenv').config();

const base = {
	username: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || '2',
	database: process.env.DB_NAME || 'Wedding_Web',
	host: process.env.DB_HOST || 'localhost',
	port: Number(process.env.DB_PORT) || 5432,
	dialect: 'postgres'
};

module.exports = {
	development: { ...base },
	test: { ...base },
	production: { ...base, logging: false }
};

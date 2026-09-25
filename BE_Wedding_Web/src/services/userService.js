const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../models');
const env = require('../config/env');
const { assertCredentials, BCRYPT_ROUNDS } = require('../utils/credentials');

// Hash cố định của 1 mật khẩu ngẫu nhiên — chỉ dùng để tiêu tốn đúng lượng thời gian
// như một lần so sánh thật khi username không tồn tại.
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.9x7cL4z9r5gJmN0mCFwOLhUEpLqLmXK';

const buildToken = (user) => {
	// Secret lấy từ config/env.js — nơi đã từ chối khởi động nếu secret là placeholder.
	const secret = env.jwtSecret;
	const expiresIn = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '7d';

	return jwt.sign(
		{
			id: user.id,
			username: user.username,
			role: user.role || 'user'
		},
		secret,
		{ expiresIn }
	);
};

const sanitizeUser = (user) => ({
	id: user.id,
	username: user.username,
	role: user.role,
	slot: user.slot || 0,
	created_at: user.created_at,
	updated_at: user.updated_at
});

// LƯU Ý BẢO MẬT: `role` cố tình KHÔNG lấy từ payload. Trước đây hàm này nhận
// `role` từ req.body nên bất kỳ ai cũng tự đăng ký được tài khoản admin
// (POST /api/users/register {"role":"admin"}). Việc gán quyền chỉ đi qua
// adminService (admin đã đăng nhập) — xem adminService.createUser/updateUser.
const register = async ({ username: rawUsername, password: rawPassword }) => {
	const { username, password } = assertCredentials(rawUsername, rawPassword);
	const role = 'user';

	const existed = await User.findOne({ where: { username } });
	if (existed) {
		const error = new Error('username đã tồn tại');
		error.status = 409;
		throw error;
	}

	const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

	const user = await User.create({
		username,
		password: hashedPassword,
		role,
		slot: 0,
		created_at: new Date(),
		updated_at: new Date()
	});

	const token = buildToken(user);

	return {
		user: sanitizeUser(user),
		token
	};
};

const login = async ({ username, password }) => {
	if (!username || !password) {
		const error = new Error('username và password là bắt buộc');
		error.status = 400;
		throw error;
	}

	const user = await User.findOne({ where: { username: String(username).trim() } });

	// So sánh với 1 hash giả khi không tìm thấy user: thời gian phản hồi của
	// "sai username" và "sai password" bằng nhau -> không dò được username nào tồn tại.
	const hash = user ? (user.password || '') : DUMMY_HASH;
	const matched = await bcrypt.compare(password, hash);

	if (!user || !matched) {
		const error = new Error('Sai username hoặc password');
		error.status = 401;
		throw error;
	}

	const token = buildToken(user);

	return {
		user: sanitizeUser(user),
		token
	};
};

const getProfile = async (userId) => {
	const user = await User.findByPk(userId);
	if (!user) {
		const error = new Error('Không tìm thấy user');
		error.status = 404;
		throw error;
	}

	return sanitizeUser(user);
};

// `role` cũng KHÔNG nhận từ payload ở đây: PATCH /api/users/profile {"role":"admin"}
// từng cho phép người dùng thường tự nâng quyền lên admin.
const updateProfile = async (userId, { username }) => {
	const user = await User.findByPk(userId);
	if (!user) {
		const error = new Error('Không tìm thấy user');
		error.status = 404;
		throw error;
	}

	if (username && username !== user.username) {
		const existed = await User.findOne({
			where: {
				username,
				id: { [Op.ne]: userId }
			}
		});

		if (existed) {
			const error = new Error('username đã tồn tại');
			error.status = 409;
			throw error;
		}

		user.username = username;
	}

	user.updated_at = new Date();
	await user.save();

	return sanitizeUser(user);
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
	if (!currentPassword || !newPassword) {
		const error = new Error('currentPassword và newPassword là bắt buộc');
		error.status = 400;
		throw error;
	}

	const user = await User.findByPk(userId);
	if (!user) {
		const error = new Error('Không tìm thấy user');
		error.status = 404;
		throw error;
	}

	const matched = await bcrypt.compare(currentPassword, user.password || '');
	if (!matched) {
		const error = new Error('Mật khẩu hiện tại không đúng');
		error.status = 400;
		throw error;
	}

	assertCredentials(user.username, newPassword);
	if (newPassword === currentPassword) {
		const error = new Error('Mật khẩu mới phải khác mật khẩu hiện tại');
		error.status = 400;
		throw error;
	}

	user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
	user.updated_at = new Date();
	await user.save();

	return { changed: true };
};

module.exports = {
	register,
	login,
	getProfile,
	updateProfile,
	changePassword
};

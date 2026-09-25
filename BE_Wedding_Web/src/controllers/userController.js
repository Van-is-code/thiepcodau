const userService = require('../services/userService');

// Tự đăng ký tạm TẮT — tài khoản do admin cấp khi khách liên hệ.
// Bật lại: đặt ALLOW_PUBLIC_REGISTER=true trong .env
const register = async (req, res) => {
	if (String(process.env.ALLOW_PUBLIC_REGISTER || 'false').toLowerCase() !== 'true') {
		return res.status(403).json({
			success: false,
			message: 'Đăng ký đang tạm đóng. Vui lòng liên hệ admin để được cấp tài khoản.'
		});
	}
	try {
		const data = await userService.register(req.body);
		return res.status(201).json({
			success: true,
			message: 'Đăng ký thành công',
			data
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Đăng ký thất bại'
		});
	}
};

const login = async (req, res) => {
	try {
		const data = await userService.login(req.body);
		return res.status(200).json({
			success: true,
			message: 'Đăng nhập thành công',
			data
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Đăng nhập thất bại'
		});
	}
};

const getProfile = async (req, res) => {
	try {
		const data = await userService.getProfile(req.user.id);
		return res.status(200).json({
			success: true,
			message: 'Lấy thông tin cá nhân thành công',
			data
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Lấy thông tin cá nhân thất bại'
		});
	}
};

const updateProfile = async (req, res) => {
	try {
		const data = await userService.updateProfile(req.user.id, req.body);
		return res.status(200).json({
			success: true,
			message: 'Cập nhật thông tin cá nhân thành công',
			data
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Cập nhật thông tin cá nhân thất bại'
		});
	}
};

const changePassword = async (req, res) => {
	try {
		const data = await userService.changePassword(req.user.id, req.body);
		return res.status(200).json({
			success: true,
			message: 'Đổi mật khẩu thành công',
			data
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Đổi mật khẩu thất bại'
		});
	}
};

module.exports = {
	register,
	login,
	getProfile,
	updateProfile,
	changePassword
};

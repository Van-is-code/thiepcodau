// Chính sách username / mật khẩu dùng chung cho MỌI đường tạo tài khoản.
//
// Hệ thống này cấp tài khoản theo kiểu admin/CTV tạo hộ khách, nên đường tạo tài
// khoản chính KHÔNG phải trang tự đăng ký. Trước đây chính sách chỉ nằm trong
// userService (tự đăng ký + đổi mật khẩu), còn adminService.createUser,
// adminCtvService.createCtv và customerService.createCustomer thì mỗi nơi một kiểu
// (6 ký tự hoặc không kiểm gì) — tức là hầu hết tài khoản thật đều lọt qua.
const MIN_PASSWORD_LENGTH = Number.parseInt(process.env.MIN_PASSWORD_LENGTH, 10) || 8;

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'passw0rd',
  'qwerty123', 'qwertyui', '11111111', 'abc12345', '00000000', 'iloveyou',
  '123123123', 'admin123', 'matkhau', 'vietnam1', 'thiepcuoi',
]);

const bad = (message) => {
  const e = new Error(message);
  e.status = 400;
  return e;
};

const assertUsername = (username) => {
  const uname = String(username || '').trim();
  if (!uname) throw bad('username là bắt buộc');
  if (uname.length < 3 || uname.length > 50) throw bad('username phải dài 3–50 ký tự');
  if (!/^[a-zA-Z0-9._-]+$/.test(uname)) {
    throw bad('username chỉ được chứa chữ, số và các ký tự . _ -');
  }
  return uname;
};

const assertPassword = (password, { username } = {}) => {
  const pwd = String(password || '');
  if (!pwd) throw bad('password là bắt buộc');
  if (pwd.length < MIN_PASSWORD_LENGTH) {
    throw bad(`Mật khẩu phải dài tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  if (pwd.length > 200) throw bad('Mật khẩu quá dài (tối đa 200 ký tự)');
  if (COMMON_PASSWORDS.has(pwd.toLowerCase())) {
    throw bad('Mật khẩu quá phổ biến, dễ bị dò. Vui lòng chọn mật khẩu khác.');
  }
  if (username && pwd.toLowerCase() === String(username).trim().toLowerCase()) {
    throw bad('Mật khẩu không được trùng với tên đăng nhập');
  }
  return pwd;
};

const assertCredentials = (username, password) => {
  const uname = assertUsername(username);
  const pwd = assertPassword(password, { username: uname });
  return { username: uname, password: pwd };
};

// Số vòng bcrypt dùng thống nhất. Trước đây nơi 10 nơi 12 — mật khẩu do admin cấp
// (chiếm đa số tài khoản) lại rơi vào mức yếu hơn.
const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

module.exports = {
  MIN_PASSWORD_LENGTH,
  BCRYPT_ROUNDS,
  assertUsername,
  assertPassword,
  assertCredentials,
};

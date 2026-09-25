// Bảng tra mã BIN (6 số) -> ngân hàng, theo danh sách thành viên Napas / VietQR.
// Dùng để hiển thị tên ngân hàng sau khi quét QR. BIN lạ vẫn không sao — số tài khoản
// và tên người nhận vẫn bóc được, chỉ là không map ra tên ngân hàng.
const BANKS = {
	'970415': { shortName: 'VietinBank', name: 'Ngân hàng TMCP Công Thương Việt Nam' },
	'970436': { shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam' },
	'970418': { shortName: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
	'970405': { shortName: 'Agribank', name: 'Ngân hàng NN&PTNT Việt Nam' },
	'970422': { shortName: 'MBBank', name: 'Ngân hàng TMCP Quân đội' },
	'970407': { shortName: 'Techcombank', name: 'Ngân hàng TMCP Kỹ Thương Việt Nam' },
	'970416': { shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
	'970432': { shortName: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
	'970423': { shortName: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong' },
	'970403': { shortName: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
	'970437': { shortName: 'HDBank', name: 'Ngân hàng TMCP Phát triển TP.HCM' },
	'970431': { shortName: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam' },
	'970441': { shortName: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam' },
	'970443': { shortName: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
	'970426': { shortName: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
	'970448': { shortName: 'OCB', name: 'Ngân hàng TMCP Phương Đông' },
	'970449': { shortName: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
	'970454': { shortName: 'BVBank', name: 'Ngân hàng TMCP Bản Việt' },
	'970429': { shortName: 'SCB', name: 'Ngân hàng TMCP Sài Gòn' },
	'970428': { shortName: 'NamABank', name: 'Ngân hàng TMCP Nam Á' },
	'970409': { shortName: 'BacABank', name: 'Ngân hàng TMCP Bắc Á' },
	'970419': { shortName: 'NCB', name: 'Ngân hàng TMCP Quốc Dân' },
	'970424': { shortName: 'ShinhanBank', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam' },
	'970425': { shortName: 'ABBANK', name: 'Ngân hàng TMCP An Bình' },
	'970406': { shortName: 'DongABank', name: 'Ngân hàng TMCP Đông Á' },
	'970430': { shortName: 'PGBank', name: 'Ngân hàng TMCP Thịnh vượng và Phát triển' },
	'970433': { shortName: 'VietBank', name: 'Ngân hàng TMCP Việt Nam Thương Tín' },
	'970434': { shortName: 'IndovinaBank', name: 'Ngân hàng TNHH Indovina' },
	'970442': { shortName: 'HongLeong', name: 'Ngân hàng TNHH MTV Hong Leong Việt Nam' },
	'970438': { shortName: 'BaoVietBank', name: 'Ngân hàng TMCP Bảo Việt' },
	'970414': { shortName: 'Oceanbank', name: 'Ngân hàng TM TNHH MTV Đại Dương' },
	'970400': { shortName: 'SaigonBank', name: 'Ngân hàng TMCP Sài Gòn Công Thương' },
	'970457': { shortName: 'Woori', name: 'Ngân hàng TNHH MTV Woori Việt Nam' },
	'970458': { shortName: 'UnitedOverseas', name: 'Ngân hàng United Overseas Bank Việt Nam' },
	'970439': { shortName: 'PublicBank', name: 'Ngân hàng TNHH MTV Public Việt Nam' },
	'970463': { shortName: 'KookminHCM', name: 'Kookmin Bank - Chi nhánh TP.HCM' },
	'970462': { shortName: 'KookminHN', name: 'Kookmin Bank - Chi nhánh Hà Nội' },
	'970466': { shortName: 'KEBHanaHCM', name: 'KEB Hana - Chi nhánh TP.HCM' },
	'970467': { shortName: 'KEBHanaHN', name: 'KEB Hana - Chi nhánh Hà Nội' },
	'546034': { shortName: 'CAKE', name: 'CAKE by VPBank' },
	'546035': { shortName: 'Ubank', name: 'Ubank by VPBank' },
	'963388': { shortName: 'Timo', name: 'Timo by Bản Việt' },
	'971011': { shortName: 'VRB', name: 'Ngân hàng Liên doanh Việt - Nga' },
	'971005': { shortName: 'CIMB', name: 'Ngân hàng TNHH MTV CIMB Việt Nam' }
};

const lookupBank = (bin) => {
	const hit = BANKS[String(bin || '').trim()];
	if (hit) return { bin: String(bin), shortName: hit.shortName, name: hit.name };
	return { bin: String(bin || ''), shortName: null, name: bin ? `Ngân hàng (BIN ${bin})` : null };
};

module.exports = { BANKS, lookupBank };

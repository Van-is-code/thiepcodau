// Quy tắc giới hạn sửa thiệp. Đổi 2 hằng số này để nới/siết.
const MAX_EDITS = Number.parseInt(process.env.INVITATION_MAX_EDITS, 10) || 5;
const LOCK_DAYS_AFTER_WEDDING = Number.parseInt(process.env.INVITATION_LOCK_DAYS, 10) || 3;

// Hạn cuối được sửa = cuối ngày (ngày cưới + N ngày), theo giờ VN (UTC+7).
const computeEditDeadline = (ceremonyDate) => {
	if (!ceremonyDate) return null;
	const d = new Date(ceremonyDate);
	if (Number.isNaN(d.getTime())) return null;
	// Cộng N ngày rồi lấy 23:59:59 của ngày đó (theo UTC — khớp cách FE đọc getUTC*).
	d.setUTCDate(d.getUTCDate() + LOCK_DAYS_AFTER_WEDDING);
	d.setUTCHours(23, 59, 59, 999);
	return d;
};

// Trạng thái khoá của 1 thiệp (không cần load quan hệ).
const getLockState = (invitation) => {
	const editCount = invitation.edit_count || 0;
	const deadline = invitation.edit_deadline ? new Date(invitation.edit_deadline) : null;
	const now = new Date();

	const editsLeft = Math.max(MAX_EDITS - editCount, 0);
	const outOfEdits = editCount >= MAX_EDITS;
	const pastDeadline = Boolean(deadline && now > deadline);
	const locked = outOfEdits || pastDeadline;

	let reason = null;
	if (pastDeadline) reason = 'past_wedding';
	else if (outOfEdits) reason = 'out_of_edits';

	return {
		locked,
		reason, // 'past_wedding' | 'out_of_edits' | null
		editCount,
		editsLeft,
		maxEdits: MAX_EDITS,
		editDeadline: deadline ? deadline.toISOString() : null,
		lockDaysAfterWedding: LOCK_DAYS_AFTER_WEDDING
	};
};

const lockMessage = (state) => {
	if (state.reason === 'past_wedding') {
		return `Thiệp đã khoá sửa (quá ${LOCK_DAYS_AFTER_WEDDING} ngày sau ngày cưới). Liên hệ admin nếu cần mở lại.`;
	}
	if (state.reason === 'out_of_edits') {
		return `Thiệp đã dùng hết ${MAX_EDITS} lượt sửa. Liên hệ admin nếu cần mở thêm.`;
	}
	return 'Thiệp đang bị khoá sửa.';
};

module.exports = { MAX_EDITS, LOCK_DAYS_AFTER_WEDDING, computeEditDeadline, getLockState, lockMessage };

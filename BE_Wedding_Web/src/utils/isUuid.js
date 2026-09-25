const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chặn id không đúng định dạng UUID TRƯỚC khi query — tránh để lỗi thô của Postgres
// ("invalid input syntax for type uuid") lọt ra ngoài thành lỗi 500 khó hiểu, thường
// gặp khi FE lỡ gửi id giả/dữ liệu fallback (vd. id số 1, 2, 3) thay vì UUID thật.
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

module.exports = { isUuid };

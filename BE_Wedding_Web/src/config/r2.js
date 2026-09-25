// Cloudflare R2 — tương thích S3 API, nên dùng thẳng @aws-sdk/client-s3.
//
// Env cần thiết:
//   R2_ACCOUNT_ID          ID tài khoản Cloudflare (thấy ở góc phải dashboard)
//   R2_ACCESS_KEY_ID       API token R2 -> Access Key ID
//   R2_SECRET_ACCESS_KEY   API token R2 -> Secret Access Key
//   R2_BUCKET              tên bucket, vd "thiepcodau-media"
//   R2_PUBLIC_BASE_URL     domain CDN công khai, vd "https://cdn.thiepcuoi.me"
//                          (R2 -> Settings -> Public access -> Connect Custom Domain)
//   R2_ENDPOINT            (tuỳ chọn) ghi đè endpoint mặc định
const { S3Client } = require('@aws-sdk/client-s3');

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET = process.env.R2_BUCKET || '';
const ENDPOINT = process.env.R2_ENDPOINT || (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : '');

// Bỏ dấu / ở cuối để ghép URL không bị "//".
const PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const REGION = process.env.R2_REGION || 'auto';

// PUBLIC_BASE_URL nằm trong điều kiện "đã cấu hình" là CỐ Ý.
//
// Thiếu nó thì publicUrl() trả null -> ảnh đẩy lên R2 thành công nhưng URL lưu
// vào CSDL là null, thiệp hiện ô trắng mà không báo lỗi gì. Hỏng kiểu im lặng như
// vậy tệ hơn hỏng ồn ào nhiều: coi như chưa cấu hình để hệ thống tự quay về lưu
// cục bộ, vẫn chạy được.
const isConfigured = () => Boolean(ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_BASE_URL);

// Tách riêng để báo lỗi nói đúng chỗ thiếu, thay vì "thiếu R2_ACCOUNT_ID" chung chung.
const thieuGi = () => [
  !ACCOUNT_ID && !process.env.R2_ENDPOINT ? 'R2_ACCOUNT_ID' : null,
  !ACCESS_KEY_ID ? 'R2_ACCESS_KEY_ID' : null,
  !SECRET_ACCESS_KEY ? 'R2_SECRET_ACCESS_KEY' : null,
  !BUCKET ? 'R2_BUCKET' : null,
  !PUBLIC_BASE_URL ? 'R2_PUBLIC_BASE_URL' : null,
].filter(Boolean);

let client = null;
const getClient = () => {
  if (!isConfigured()) {
    const e = new Error('Chưa cấu hình Cloudflare R2. Thiếu: ' + thieuGi().join(', '));
    e.status = 503;
    throw e;
  }
  if (!client) {
    client = new S3Client({
      // R2 không dùng region nên để "auto". Các kho S3 khác (VNG, Viettel, FPT,
      // BizFly...) lại BẮT BUỘC region thật — đặt R2_REGION là chuyển sang dùng
      // được, không phải sửa mã.
      region: REGION,
      endpoint: ENDPOINT,
      credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
      // R2 chỉ hỗ trợ path-style addressing.
      forcePathStyle: true,
    });
  }
  return client;
};

// URL công khai của 1 object. Ưu tiên domain CDN (Cloudflare cache toàn cầu);
// không cấu hình domain thì trả null để service gọi biết mà fallback về local.
const publicUrl = (key) => {
  if (!key) return null;
  if (!PUBLIC_BASE_URL) return null;
  return `${PUBLIC_BASE_URL}/${String(key).replace(/^\/+/, '')}`;
};

module.exports = {
  getClient,
  isConfigured,
  thieuGi,
  publicUrl,
  BUCKET,
  PUBLIC_BASE_URL,
  ENDPOINT,
};

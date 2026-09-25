// Lớp trừu tượng lưu trữ tệp: Cloudflare R2 (ưu tiên) hoặc đĩa local (dự phòng).
//
// Chọn nơi lưu bằng STORAGE_DRIVER=r2|local. Không đặt -> tự dùng r2 nếu đã cấu
// hình đủ biến môi trường, ngược lại dùng local. Nhờ vậy môi trường dev không có
// credential R2 vẫn chạy được y như cũ.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const {
  PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand: PresignPut } = require('@aws-sdk/client-s3');
const r2 = require('../config/r2');

const LOCAL_ROOT = path.join(process.cwd(), 'uploads');
const API_PUBLIC_BASE = (process.env.API_PUBLIC_URL || '').replace(/\/+$/, '');

const driver = () => {
  const explicit = String(process.env.STORAGE_DRIVER || '').trim().toLowerCase();
  if (explicit === 'r2' || explicit === 'local') return explicit;
  return r2.isConfigured() ? 'r2' : 'local';
};

// Khoá object phải an toàn: không cho ".." hay "/" đầu chuỗi thoát khỏi thư mục gốc.
const assertSafeKey = (key) => {
  const k = String(key || '').replace(/^\/+/, '');
  if (!k || k.length > 900) {
    const e = new Error('Đường dẫn tệp không hợp lệ'); e.status = 400; throw e;
  }
  if (k.includes('..') || k.includes(String.fromCharCode(92)) || /[\u0000-\u001f]/.test(k)) {
    const e = new Error('Đường dẫn tệp chứa ký tự không an toàn'); e.status = 400; throw e;
  }
  // "C:/..." không bao giờ là khoá kho hợp lệ. Với R2 thì chỉ là khoá kỳ quặc,
  // nhưng với ổ đĩa cục bộ nó là mầm mống thoát thư mục — chặn từ đây cho gọn.
  if (/^[a-zA-Z]:/.test(k)) {
    const e = new Error('Đường dẫn tệp không hợp lệ'); e.status = 400; throw e;
  }
  return k;
};

// Tên tệp nội dung-địa chỉ: đổi ảnh thì khoá đổi theo -> cache CDN 1 năm vô tư,
// không bao giờ phải purge và người xem không bao giờ thấy ảnh cũ.
const contentHashedKey = ({ prefix, buffer, ext }) => {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
  const clean = String(ext || '').replace(/^\.?/, '.').toLowerCase();
  return assertSafeKey(`${String(prefix).replace(/^\/+|\/+$/g, '')}/${hash}${clean}`);
};

// Ảnh có khoá theo hash nội dung -> bất biến, cache tối đa.
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

// ---------------------------------------------------------------------------
// R2
// ---------------------------------------------------------------------------
const r2Put = async (key, buffer, { contentType, cacheControl = IMMUTABLE_CACHE, metadata } = {}) => {
  await r2.getClient().send(new PutObjectCommand({
    Bucket: r2.BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: cacheControl,
    Metadata: metadata,
  }));
  const url = r2.publicUrl(key);
  // Không bao giờ trả về URL rỗng: ghi null vào CSDL là thiệp hiện ô trắng vĩnh
  // viễn mà không ai biết vì sao. Thà hỏng ngay lúc tải lên, có thông báo rõ.
  if (!url) {
    const e = new Error('Đã lưu lên R2 nhưng chưa đặt R2_PUBLIC_BASE_URL nên không dựng được link ảnh.');
    e.status = 503; throw e;
  }
  return { key, url, driver: 'r2' };
};

const r2Delete = async (key) => {
  await r2.getClient().send(new DeleteObjectCommand({ Bucket: r2.BUCKET, Key: key }));
};

const r2DeleteMany = async (keys) => {
  const list = keys.filter(Boolean);
  if (!list.length) return;
  // API DeleteObjects giới hạn 1000 khoá mỗi lần.
  for (let i = 0; i < list.length; i += 1000) {
    await r2.getClient().send(new DeleteObjectsCommand({
      Bucket: r2.BUCKET,
      Delete: { Objects: list.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
    }));
  }
};

const r2Head = async (key) => {
  try {
    const r = await r2.getClient().send(new HeadObjectCommand({ Bucket: r2.BUCKET, Key: key }));
    return { exists: true, size: Number(r.ContentLength) || 0, contentType: r.ContentType || null };
  } catch (_e) {
    return { exists: false, size: 0, contentType: null };
  }
};

const r2Exists = async (key) => (await r2Head(key)).exists;

// Tải object về bộ nhớ. Dùng cho luồng "trình duyệt đẩy thẳng lên R2": server
// kéo bản gốc xuống để chạy dây chuyền xử lý ảnh rồi xoá bản gốc đi.
const r2Get = async (key) => {
  const r = await r2.getClient().send(new GetObjectCommand({ Bucket: r2.BUCKET, Key: key }));
  const chunks = [];
  for await (const c of r.Body) chunks.push(c);
  return Buffer.concat(chunks);
};

// ---------------------------------------------------------------------------
// Local (dự phòng khi chưa có R2)
// ---------------------------------------------------------------------------
const localPathOf = (key) => {
  const safe = assertSafeKey(key);
  const abs = path.resolve(LOCAL_ROOT, safe);
  // Chốt chặn cuối: đường dẫn tuyệt đối phải nằm trong uploads/.
  if (abs !== LOCAL_ROOT && !abs.startsWith(LOCAL_ROOT + path.sep)) {
    const e = new Error('Đường dẫn tệp nằm ngoài thư mục cho phép'); e.status = 400; throw e;
  }
  return abs;
};

const localPut = async (key, buffer) => {
  const abs = localPathOf(key);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, buffer);
  const rel = `/uploads/${assertSafeKey(key)}`;
  return { key, url: API_PUBLIC_BASE ? `${API_PUBLIC_BASE}${rel}` : rel, driver: 'local' };
};

const localDelete = async (key) => {
  try {
    await fsp.unlink(localPathOf(key));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

// ---------------------------------------------------------------------------
// API chung
// ---------------------------------------------------------------------------
const put = async (key, buffer, options = {}) => {
  const k = assertSafeKey(key);
  return driver() === 'r2' ? r2Put(k, buffer, options) : localPut(k, buffer);
};

const remove = async (key) => {
  if (!key) return;
  const k = assertSafeKey(key);
  return driver() === 'r2' ? r2Delete(k) : localDelete(k);
};

const removeMany = async (keys = []) => {
  const safe = keys.filter(Boolean).map(assertSafeKey);
  if (driver() === 'r2') return r2DeleteMany(safe);
  await Promise.all(safe.map(localDelete));
};

const exists = async (key) => {
  if (!key) return false;
  const k = assertSafeKey(key);
  if (driver() === 'r2') return r2Exists(k);
  return fs.existsSync(localPathOf(k));
};

// Xem thông tin object mà KHÔNG tải nội dung — để chặn tệp quá to trước khi
// kéo về, đỡ tốn RAM server vì một tệp 500MB ai đó cố tình đẩy lên.
const head = async (key) => {
  if (!key) return { exists: false, size: 0, contentType: null };
  const k = assertSafeKey(key);
  if (driver() === 'r2') return r2Head(k);
  const p = localPathOf(k);
  if (!fs.existsSync(p)) return { exists: false, size: 0, contentType: null };
  return { exists: true, size: fs.statSync(p).size, contentType: null };
};

const getObject = async (key) => {
  const k = assertSafeKey(key);
  return driver() === 'r2' ? r2Get(k) : fsp.readFile(localPathOf(k));
};

const urlFor = (key) => {
  if (!key) return null;
  const k = assertSafeKey(key);
  if (driver() === 'r2') return r2.publicUrl(k);
  const rel = `/uploads/${k}`;
  return API_PUBLIC_BASE ? `${API_PUBLIC_BASE}${rel}` : rel;
};

// URL ký sẵn để trình duyệt PUT thẳng lên R2 (bỏ qua backend).
// Dùng cho album ảnh cưới nhiều/nặng: không tốn băng thông và RAM của server.
const presignUpload = async (key, { contentType, expiresIn = 600 } = {}) => {
  if (driver() !== 'r2') {
    const e = new Error('Tải trực tiếp chỉ hỗ trợ khi đã bật Cloudflare R2'); e.status = 503; throw e;
  }
  const k = assertSafeKey(key);
  const command = new PresignPut({
    Bucket: r2.BUCKET,
    Key: k,
    ContentType: contentType,
    CacheControl: IMMUTABLE_CACHE,
  });
  const uploadUrl = await getSignedUrl(r2.getClient(), command, { expiresIn });
  return { uploadUrl, key: k, publicUrl: r2.publicUrl(k), expiresIn };
};

module.exports = {
  driver,
  put,
  remove,
  removeMany,
  exists,
  head,
  getObject,
  urlFor,
  presignUpload,
  contentHashedKey,
  assertSafeKey,
  IMMUTABLE_CACHE,
  isR2: () => driver() === 'r2',
};

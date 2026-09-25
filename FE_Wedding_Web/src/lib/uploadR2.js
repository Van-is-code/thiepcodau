// Đẩy ảnh THẲNG lên Cloudflare R2, không qua backend.
//
// Vì sao đáng làm: máy chủ đặt ở nhà, đường lên của mạng nhà thường rất hẹp.
// Ảnh cưới 20MB đi qua đó là khách ngồi chờ. Đẩy lên Cloudflare thì máy khách
// nói chuyện với điểm mạng gần nhất, nhanh hơn hẳn; server chỉ việc kéo bản gốc
// về bằng đường xuống (luôn rộng hơn) để xử lý.
//
// Luôn có đường lui: chưa bật R2 thì presign trả 503, khi đó quay về cách cũ —
// tải qua backend. Người dùng không cần biết hệ thống đang đi đường nào.
import { api } from '../api'

// Kiểu tệp R2 nhận. Khớp với danh sách server kiểm ở /presign.
const KIEU_NHAN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic'])

export const coTheDayThang = (file) => Boolean(file && KIEU_NHAN.has(String(file.type).toLowerCase()))

/**
 * Trả về bản ghi ảnh nếu đẩy thẳng thành công, null nếu không đi được đường này
 * (chưa bật R2, trình duyệt cũ, mạng lỗi) để nơi gọi tự quay về cách cũ.
 *
 * onProgress nhận số 0..1 — đẩy thẳng mới theo dõi được tiến độ thật, đường cũ
 * qua backend thì không.
 */
export const dayThangLenR2 = async (file, { invitationId, imageType, sortOrder, imageAlt, replaceId, onProgress } = {}) => {
  if (!coTheDayThang(file)) return null

  let ky
  try {
    const r = await api.presignInvitationImage(invitationId, String(file.type).toLowerCase())
    ky = r.data?.data || r.data
  } catch (_e) {
    return null // 503 = chưa bật R2. Không phải lỗi, chỉ là đi đường khác.
  }
  if (!ky?.uploadUrl || !ky?.key) return null

  const xong = await new Promise((resolve) => {
    // Dùng XMLHttpRequest thay vì fetch chỉ vì cần sự kiện tiến độ tải lên.
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', ky.uploadUrl, true)
    xhr.setRequestHeader('Content-Type', file.type)
    if (onProgress) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total) }
    }
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
    xhr.onerror = () => resolve(false)
    xhr.ontimeout = () => resolve(false)
    xhr.send(file)
  })
  // PUT hỏng (CORS chưa mở, link hết hạn, mạng rớt) -> để nơi gọi dùng đường cũ.
  if (!xong) return null

  const r = await api.attachInvitationImage({
    invitation_id: invitationId,
    key: ky.key,
    image_type: imageType,
    sort_order: sortOrder,
    image_alt: imageAlt,
    replace_id: replaceId || undefined,
  })
  return r.data?.data || r.data
}

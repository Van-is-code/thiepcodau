// Các API danh sách (invitations, invitation-templates, guests, messages-checkins...)
// đều trả về { success, message, data: { items: [...], pagination: {...} } }. Gọi luôn
// là toArray(res.data) ở khắp nơi trong app — nên phải đào đúng vào .data.items, không
// phải chỉ .data (là 1 object {items, pagination}, không phải mảng) như trước đây,
// khiến mọi trang danh sách luôn coi như rỗng và rơi về dữ liệu giả/fallback.
export const toArray = (responseData) => {
  if (Array.isArray(responseData)) return responseData
  if (Array.isArray(responseData?.items)) return responseData.items
  if (Array.isArray(responseData?.data?.items)) return responseData.data.items
  if (Array.isArray(responseData?.data)) return responseData.data
  return []
}

export const formatDate = (value) => {
  if (!value) return "N/A"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "N/A"
  return date.toLocaleDateString("vi-VN")
}

export const invitationName = (inv) => {
  const groom = inv?.groom?.name_groom || inv?.groom || "Chua cap nhat"
  const bride = inv?.bride?.name_bride || inv?.bride || "Chua cap nhat"
  return `${groom} & ${bride}`
}

export const invitationSlug = (inv) => inv?.invitation_slug || inv?.slug || ""

export const invitationPublicUrl = (inv) => {
  const slug = invitationSlug(inv)
  if (!slug) return ""
  return `${window.location.origin}/${slug}`
}

export const normalizeCheckinStatus = (item) => {
  const raw = String(item?.attending_status || item?.confirm_attendance || item?.attend || item?.status || "").toLowerCase().trim()
  if (!raw) return "maybe"

  if (
    ["no", "false", "0", "absent", "reject", "khong", "không", "khong_tham_du", "khong tham du"].includes(raw) ||
    raw.includes("không") ||
    raw.includes("khong") ||
    raw.includes("tiếc") ||
    raw.includes("tiec") ||
    raw.includes("bận") ||
    raw.includes("ban") ||
    raw.includes("vắng") ||
    raw.includes("vang") ||
    raw.includes("từ chối") ||
    raw.includes("tu choi")
  ) {
    return "no"
  }

  if (
    ["yes", "true", "1", "attending", "join", "co", "có", "tham_du", "tham du", "tham dự"].includes(raw) ||
    raw.includes("tham dự") ||
    raw.includes("tham du") ||
    raw.includes("sẽ đến") ||
    raw.includes("se den") ||
    raw.includes("có mặt") ||
    raw.includes("co mat") ||
    raw.includes("đồng ý") ||
    raw.includes("dong y") ||
    raw.includes("chắc chắn") ||
    raw.includes("tham gia")
  ) {
    return "yes"
  }

  return "maybe"
}

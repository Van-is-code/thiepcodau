import axios from 'axios'

// Địa chỉ gốc của API.
//
// Đặt VITE_API_URL=same-origin nghĩa là "gọi cùng tên miền đang mở" — mọi đường
// dẫn thành tương đối (/api/..., /uploads/...). Đây là cách chạy trên máy chủ
// nhà: bản build KHÔNG dính cứng tên miền nào, nên thêm hay đổi tên miền về sau
// đều không phải dựng lại giao diện.
//
// Dùng chữ "same-origin" chứ không dùng chuỗi rỗng: đặt biến rỗng ở dòng lệnh
// thì Vite coi như chưa đặt và rơi về địa chỉ mặc định — lỗi này rất khó thấy
// vì bản build vẫn chạy, chỉ là gọi nhầm sang máy chủ khác.
const RAW_API_URL = import.meta.env.VITE_API_URL
export const API_BASE = RAW_API_URL === undefined
  ? 'https://api.thiepcuoi.me'
  : (RAW_API_URL === 'same-origin' ? '' : String(RAW_API_URL).replace(/\/+$/, ''))

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Token hết hạn (JWT_EXPIRES_IN mặc định 7 ngày) thì mọi request sau đó đều 401 và
// giao diện đứng im không rõ lý do. Ở đây dọn token rồi đưa về trang đăng nhập.
// Bỏ qua chính request đăng nhập để thông báo "sai mật khẩu" vẫn hiển thị bình thường.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ''
    const isAuthCall = url.includes('/users/login') || url.includes('/users/register')

    if (status === 401 && !isAuthCall) {
      localStorage.removeItem('token')
      const publicPrefixes = ['/auth', '/login', '/templates', '/mau-thiep', '/preview', '/pay']
      const isPublicPath = publicPrefixes.some((p) => window.location.pathname.startsWith(p))
      if (!isPublicPath) {
        window.location.assign('/auth')
      }
    }

    // 429 = bị giới hạn tần suất. Gắn cờ để giao diện hiện thông báo "thử lại sau"
    // thay vì thông báo lỗi chung chung.
    if (status === 429) {
      error.isRateLimited = true
      error.retryAfterSeconds = Number(error?.response?.headers?.['retry-after']) || null
    }
    return Promise.reject(error)
  }
)

export const api = {
  // Auth
  login: (username, password) =>
    apiClient.post('/api/users/login', { username, password }),
  register: (username, password) =>
    apiClient.post('/api/users/register', { username, password }),

  // Invitations
  getInvitations: () => apiClient.get('/api/invitations'),
  getInvitationById: (id) => apiClient.get(`/api/invitations/${id}`),
  getInvitationBySlug: (slug) => apiClient.get(`/api/invitations/slug/${slug}`),
  createInvitation: (data) => apiClient.post('/api/invitations', data),
  // Tạo 1 thiệp "nháp" chỉ từ template_id — dùng cho luồng sửa trực tiếp trên thiệp.
  createDraftInvitation: (templateId) => apiClient.post('/api/invitations/draft', { template_id: templateId }),
  updateInvitation: (id, data) => apiClient.put(`/api/invitations/${id}`, data),
  deleteInvitation: (id) => apiClient.delete(`/api/invitations/${id}`),
  // Lưu 1 lượt từ trình sửa (gộp invitation + groom + bride) — tính 1 lượt sửa.
  editorSaveInvitation: (id, payload) => apiClient.post(`/api/invitations/${id}/editor-save`, payload),
  // Đổi mẫu — KHÔNG tính vào hạn mức sửa.
  changeInvitationTemplate: (id, templateId) => apiClient.patch(`/api/invitations/${id}/template`, { template_id: templateId }),
  // Nhạc nền (nhiều link / kho nhạc) — KHÔNG tính vào hạn mức.
  setInvitationMusic: (id, playlist) => apiClient.patch(`/api/invitations/${id}/music`, { music_playlist: playlist }),
  // Tài khoản ngân hàng mừng cưới (1 QR chung) — KHÔNG tính vào hạn mức.
  setInvitationBank: (id, bank) => apiClient.patch(`/api/invitations/${id}/bank`, bank),

  // Templates
  getTemplates: () => apiClient.get('/api/invitation-templates'),
  getTemplateById: (id) => apiClient.get(`/api/invitation-templates/${id}`),
  // formData: FormData với field "package" (file .zip), template_code, template_name, [entry_file], [status], [schema]
  uploadTemplatePackage: (formData) =>
    apiClient.post('/api/invitation-templates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Guests
  getGuests: (invitationId) => apiClient.get(`/api/guests?invitation_id=${invitationId}`),
  // Trang thiệp công khai đọc tên khách qua chuỗi mã hoá trong link riêng
  // (?guest_name=...). Không còn tra theo id trần — xem BE guestService.getPublicByToken.
  getPublicGuest: (token) => apiClient.get(`/api/guests/public?token=${encodeURIComponent(token)}`),
  createGuest: (data) => apiClient.post('/api/guests', data),
  updateGuest: (id, data) => apiClient.put(`/api/guests/${id}`, data),
  deleteGuest: (id) => apiClient.delete(`/api/guests/${id}`),

  // Messages/Checkins
  // Route đúng: /invitation/:id (route ?invitationId= lọc sai tên cột -> 500).
  getCheckins: (invitationId) =>
    apiClient.get(`/api/messages-checkins/invitation/${invitationId}`),
  createCheckin: (data) => apiClient.post('/api/messages-checkins', data),

  // Grooms
  getGrooms: () => apiClient.get('/api/grooms'),
  createGroom: (data) => apiClient.post('/api/grooms', data),
  updateGroom: (id, data) => apiClient.put(`/api/grooms/${id}`, data),

  // Brides
  getBrides: () => apiClient.get('/api/brides'),
  createBride: (data) => apiClient.post('/api/brides', data),
  updateBride: (id, data) => apiClient.put(`/api/brides/${id}`, data),

  // Quét QR ngân hàng: tải lên ảnh QR -> BE tự bóc BIN / STK / tên chủ TK + sinh QR sạch.
  // Không lưu ảnh gốc người dùng tải lên.
  scanBankQr: (formData) =>
    apiClient.post('/api/bank-qr/scan', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  // Kho nhạc dùng chung
  listMusicLibrary: () => apiClient.get('/api/music-library'),
  addMusicLink: (title, url) => apiClient.post('/api/music-library', { title, url }),
  addMusicFile: (formData) =>
    apiClient.post('/api/music-library', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteMusicTrack: (id) => apiClient.delete(`/api/music-library/${encodeURIComponent(id)}`),

  // Nhạc RIÊNG của chính khách: tải thẳng lên máy chủ, không vào kho chung.
  uploadOwnMusic: (invitationId, file) => {
    const fd = new FormData()
    fd.append('music', file)
    fd.append('invitation_id', invitationId)
    return apiClient.post('/api/media-upload/music/local', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Invitation images (upload trực tiếp, lưu local trên BE — dùng cho editor sửa trực tiếp)
  createInvitationImage: (formData) =>
    apiClient.post('/api/invitation-images', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateInvitationImage: (id, formData) =>
    apiClient.patch(`/api/invitation-images/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  listInvitationImages: (invitationId) =>
    apiClient.get(`/api/invitation-images?invitation_id=${invitationId}`),
  deleteInvitationImage: (id) => apiClient.delete(`/api/invitation-images/${id}`),
  // Xin URL ký sẵn để trình duyệt PUT ảnh THẲNG lên Cloudflare R2, không qua backend.
  presignInvitationImage: (invitationId, contentType) =>
    apiClient.post('/api/invitation-images/presign', { invitation_id: invitationId, content_type: contentType }),
  // Báo server hoàn tất sau khi đã PUT thẳng lên R2.
  attachInvitationImage: (payload) =>
    apiClient.post('/api/invitation-images/attach', payload),

  // User Profile
  getProfile: () => apiClient.get('/api/users/profile'),
  // BE khai báo PATCH /api/users/profile — gọi PUT sẽ luôn trả 404.
  updateProfile: (data) => apiClient.patch('/api/users/profile', data),
  changePassword: (currentPassword, newPassword) =>
    apiClient.post('/api/users/change-password', { currentPassword, newPassword }),

  // Payments
  requestPayment: (slotQuantity, amount) =>
    apiClient.post('/api/payments/request-payment', { slotQuantity, amount }),
  checkPaymentStatus: (orderId) =>
    apiClient.post('/api/payments/check-payment-status', { orderId }),
  getOrders: (page = 1, limit = 20) =>
    apiClient.get(`/api/payments/orders?page=${page}&limit=${limit}`),
  getOrderById: (orderId) => apiClient.get(`/api/payments/orders/${orderId}`),
  cancelOrder: (orderId) => apiClient.delete(`/api/payments/orders/${orderId}`),

  // Trang thanh toán công khai payOS (không cần đăng nhập)
  payPublic: {
    get: (token) => apiClient.get(`/api/payments/public/${token}`),
    refresh: (token) => apiClient.post(`/api/payments/public/${token}/refresh`),
  },

  // ----- Cộng tác viên (CTV) -----
  ctv: {
    me: () => apiClient.get('/api/ctv/me'),
    dashboard: () => apiClient.get('/api/ctv/dashboard'),
    updatePayoutSettings: (data) => apiClient.patch('/api/ctv/me/payout-settings', data),

    listCustomers: (params = {}) => apiClient.get('/api/ctv/customers', { params }),
    createCustomer: (data) => apiClient.post('/api/ctv/customers', data),
    getCustomer: (id) => apiClient.get(`/api/ctv/customers/${id}`),
    updateCustomer: (id, data) => apiClient.patch(`/api/ctv/customers/${id}`, data),
    customerOrders: (id, params = {}) => apiClient.get(`/api/ctv/customers/${id}/orders`, { params }),
    customerCards: (id) => apiClient.get(`/api/ctv/customers/${id}/cards`),

    createOrder: (customerId, productCode) =>
      apiClient.post('/api/ctv/orders', { customerId, productCode }),
    listOrders: (params = {}) => apiClient.get('/api/ctv/orders', { params }),
    getOrder: (id) => apiClient.get(`/api/ctv/orders/${id}`),
    orderPayment: (id) => apiClient.get(`/api/ctv/orders/${id}/payment`),
    cancelOrder: (id) => apiClient.post(`/api/ctv/orders/${id}/cancel`),

    wallet: (params = {}) => apiClient.get('/api/ctv/wallet', { params }),
    // Sổ thu hộ: nền tảng đã thu hộ bao nhiêu, đã chi lại bao nhiêu.
    collections: (params = {}) => apiClient.get('/api/ctv/collections', { params }),
    listPayouts: (params = {}) => apiClient.get('/api/ctv/payout-requests', { params }),
    createPayout: (amount, note) => apiClient.post('/api/ctv/payout-requests', { amount, note }),
    cancelPayout: (id) => apiClient.post(`/api/ctv/payout-requests/${id}/cancel`),
  },

  // ----- Admin -----
  admin: {
    stats: () => apiClient.get('/api/admin/stats'),
    listUsers: (params = {}) => apiClient.get('/api/admin/users', { params }),
    createUser: (data) => apiClient.post('/api/admin/users', data),
    updateUser: (id, data) => apiClient.patch(`/api/admin/users/${id}`, data),
    addSlots: (id, delta) => apiClient.post(`/api/admin/users/${id}/slots`, { delta }),
    deleteUser: (id) => apiClient.delete(`/api/admin/users/${id}`),
    getUserDetail: (id) => apiClient.get(`/api/admin/users/${id}`),
    // Admin tạo thiệp HỘ khách — thiệp thuộc tài khoản khách, không trừ lượt.
    createUserInvitation: (userId, templateId) =>
      apiClient.post(`/api/admin/users/${userId}/invitations`, { template_id: templateId }),
    listInvitations: (params = {}) => apiClient.get('/api/admin/invitations', { params }),
    getInvitation: (id) => apiClient.get(`/api/admin/invitations/${id}`),
    unlockInvitation: (id, body = {}) => apiClient.patch(`/api/admin/invitations/${id}/unlock`, body),
    lockInvitation: (id) => apiClient.patch(`/api/admin/invitations/${id}/lock`, {}),
    deleteInvitation: (id) => apiClient.delete(`/api/admin/invitations/${id}`),
    listTemplates: () => apiClient.get('/api/admin/templates'),

    // ----- Nhập theme + quản lý mẫu -----
    // Xem trước: chạy bộ chuyển đổi nhưng KHÔNG ghi gì, trả báo cáo để admin soát
    // trước khi nhập thật.
    previewTheme: (formData) =>
      apiClient.post('/api/admin/templates/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    importTheme: (formData) =>
      apiClient.post('/api/admin/templates/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    // Bỏ bản xem trước tạm khi admin đóng hộp thoại (không đợi hết hạn 2 giờ).
    discardPreview: (token) => apiClient.delete(`/api/admin/templates/preview/${token}`),

    listManagedTemplates: (params = {}) => apiClient.get('/api/admin/templates/manage', { params }),
    getManagedTemplate: (id) => apiClient.get(`/api/admin/templates/manage/${id}`),
    updateManagedTemplate: (id, data) => apiClient.patch(`/api/admin/templates/manage/${id}`, data),
    // Chỉ xoá được khi chưa có thiệp nào dùng; BE trả 409 kèm lời nhắc nên tắt thay vì xoá.
    deleteManagedTemplate: (id) => apiClient.delete(`/api/admin/templates/manage/${id}`),

    // Cấp quyền dùng mẫu: grantee_type = 'ctv' | 'customer' | 'user'
    grantTemplate: (id, data) => apiClient.post(`/api/admin/templates/manage/${id}/grants`, data),
    toggleTemplateGrant: (permissionId, enabled) =>
      apiClient.patch(`/api/admin/templates/grants/${permissionId}`, { enabled }),
    revokeTemplateGrant: (permissionId) => apiClient.delete(`/api/admin/templates/grants/${permissionId}`),
    updateTemplate: (id, data) => apiClient.patch(`/api/admin/templates/${id}`, data),
    deleteTemplate: (id) => apiClient.delete(`/api/admin/templates/${id}`),

    // ----- Hệ CTV -----
    listCtvs: (params = {}) => apiClient.get('/api/admin/ctvs', { params }),
    createCtv: (data) => apiClient.post('/api/admin/ctvs', data),
    getCtv: (id) => apiClient.get(`/api/admin/ctvs/${id}`),
    updateCtv: (id, data) => apiClient.patch(`/api/admin/ctvs/${id}`, data),
    lockCtv: (id) => apiClient.post(`/api/admin/ctvs/${id}/lock`),
    unlockCtv: (id) => apiClient.post(`/api/admin/ctvs/${id}/unlock`),
    ctvStats: (id) => apiClient.get(`/api/admin/ctvs/${id}/stats`),
    createPayoutForCtv: (id, amount, note, allowBelowMin = false) =>
      apiClient.post(`/api/admin/ctvs/${id}/payout-requests`,
        { amount, note, allow_below_min: allowBelowMin }),

    listProducts: () => apiClient.get('/api/admin/products'),
    updateProduct: (id, data) => apiClient.patch(`/api/admin/products/${id}`, data),

    listCtvOrders: (params = {}) => apiClient.get('/api/admin/ctv-orders', { params }),
    listCtvCustomers: (params = {}) => apiClient.get('/api/admin/ctv-customers', { params }),
    listPaymentTransactions: (params = {}) => apiClient.get('/api/admin/payment-transactions', { params }),
    refundCtvOrder: (id, reason) => apiClient.post(`/api/admin/ctv-orders/${id}/refund`, { reason }),

    reconciliation: (params = {}) => apiClient.get('/api/admin/reconciliation', { params }),

    listPayoutRequests: (params = {}) => apiClient.get('/api/admin/payout-requests', { params }),
    // mode: 'payos' = chi hộ tự động | 'manual' = admin tự chuyển khoản.
    approvePayout: (id, data) => apiClient.post(`/api/admin/payout-requests/${id}/approve`, data),
    approvePayoutViaPayos: (id, data = {}) =>
      apiClient.post(`/api/admin/payout-requests/${id}/approve`, { ...data, mode: 'payos' }),
    payoutBalance: () => apiClient.get('/api/admin/payouts/balance'),
    reconcileDisbursements: (olderThanMinutes = 15) =>
      apiClient.post('/api/admin/payouts/reconcile', { older_than_minutes: olderThanMinutes }),
    collectionSummary: (params = {}) => apiClient.get('/api/admin/collections/summary', { params }),
    collectionByCtv: () => apiClient.get('/api/admin/collections/by-ctv'),
    rejectPayout: (id, data) => apiClient.post(`/api/admin/payout-requests/${id}/reject`, data),
    runAutoSweep: (force = false) => apiClient.post('/api/admin/payout/run-auto-sweep', { force }),

    // Chính sách rút tiền toàn hệ: mức rút tối thiểu + lịch quét tự động.
    getPayoutPolicy: () => apiClient.get('/api/admin/payout/policy'),
    updatePayoutPolicy: (data) => apiClient.patch('/api/admin/payout/policy', data),
    previewPayoutPolicy: (minPayoutAmount) =>
      apiClient.get('/api/admin/payout/policy/preview', { params: { min_payout_amount: minPayoutAmount } }),

    listAuditLogs: (params = {}) => apiClient.get('/api/admin/audit-logs', { params }),

    // ---- Kho nhạc ----
    listMusicAdmin: (params = {}) => apiClient.get('/api/music-library/admin', { params }),
    addMusicTrack: (payload) => {
      // Có tệp thì gửi multipart, không thì gửi JSON kèm link.
      if (payload instanceof FormData) {
        return apiClient.post('/api/music-library', payload,
          { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      return apiClient.post('/api/music-library', payload)
    },
    updateMusicTrack: (id, data) =>
      apiClient.patch(`/api/music-library/${encodeURIComponent(id)}`, data),
    musicTrackUsage: (id) =>
      apiClient.get(`/api/music-library/${encodeURIComponent(id)}/usage`),
    removeMusicTrack: (id, force = false) =>
      apiClient.delete(`/api/music-library/${encodeURIComponent(id)}`, { params: { force } }),
  },
}

export default apiClient

import React, { useRef, useState } from 'react'
import { api, API_BASE } from '../api'
import {
  IconSliders,
  IconCheckSquare,
  IconMessageCircle,
  IconCreditCard,
  IconImage,
  IconUploadCloud,
  IconTrash2,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconSparkles,
} from './Icons'

function toAbsoluteUrl(url) {
  if (!url || typeof url !== 'string') return ''
  if (/^(https?:|data:|blob:)/i.test(url) || url.startsWith('//')) return url
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

export default function DisplaySettingsPanel({ invitation, onSaved, onClose }) {
  const extra = invitation?.extra_data || {}
  const fileInputRef = useRef(null)

  // 1. RSVP: Xác nhận tham gia
  const [showRsvp, setShowRsvp] = useState(
    extra.show_rsvp !== undefined ? Boolean(extra.show_rsvp) : (invitation?.show_rsvp !== undefined ? Boolean(invitation.show_rsvp) : true)
  )

  // 2a. Gửi lời chúc
  const [allowWishes, setAllowWishes] = useState(
    extra.allow_wishes !== undefined ? Boolean(extra.allow_wishes) : (invitation?.allow_wishes !== undefined ? Boolean(invitation.allow_wishes) : true)
  )

  // 2b. Hiển thị danh sách lời chúc
  const [showWishesList, setShowWishesList] = useState(
    extra.show_wishes_list !== undefined ? Boolean(extra.show_wishes_list) : (invitation?.show_wishes_list !== undefined ? Boolean(invitation.show_wishes_list) : true)
  )

  // 3. Nút gửi quà mừng
  const [showGiftBox, setShowGiftBox] = useState(
    extra.show_gift_box !== undefined ? Boolean(extra.show_gift_box) : (invitation?.show_gift_box !== undefined ? Boolean(invitation.show_gift_box) : true)
  )

  // 4. Ảnh nền background
  const [bgImage, setBgImage] = useState(
    extra.background_image || invitation?.background_image || ''
  )

  const [showAlbumModal, setShowAlbumModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Album ảnh hiện có của thiệp
  const existingImages = (invitation?.images || []).filter((img) => img && img.image_url)

  // Kiểm tra điều kiện di chuyển nút quà mừng lên dưới gallery
  const isGiftRelocated = !showRsvp && !allowWishes && !showWishesList && showGiftBox

  const handleUploadBg = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setErr('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('invitation_id', invitation?.id || '')
      formData.append('image_type', 'background')
      formData.append('sort_order', '0')
      formData.append('image_alt', 'Ảnh nền thiệp cưới')

      const res = await api.createInvitationImage(formData)
      const data = res.data?.data || res.data
      if (data?.image_url) {
        setBgImage(data.image_url)
      } else {
        throw new Error('Không nhận được đường dẫn ảnh sau khi tải lên')
      }
    } catch (error) {
      console.error('Lỗi tải ảnh nền:', error)
      setErr(error?.response?.data?.message || error.message || 'Tải ảnh nền thất bại')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    const payload = {
      show_rsvp: Boolean(showRsvp),
      allow_wishes: Boolean(allowWishes),
      show_wishes_list: Boolean(showWishesList),
      show_gift_box: Boolean(showGiftBox),
      background_image: String(bgImage || '').trim(),
    }

    try {
      if (invitation?.id) {
        await api.setDisplaySettings(invitation.id, payload)
      }
      onSaved && onSaved(payload)
    } catch (error) {
      console.error('Lỗi lưu cài đặt giao diện:', error)
      setErr(error?.response?.data?.message || error.message || 'Lưu cài đặt thất bại')
      setSaving(false)
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.drawer}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.iconBadge}>
              <IconSliders size={18} color="#c96547" />
            </div>
            <div>
              <h3 style={S.headerTitle}>Tuỳ Biến Tính Năng & Giao Diện</h3>
              <p style={S.headerSubtitle}>Bật tắt các khối chức năng và cài đặt ảnh nền thiệp cưới</p>
            </div>
          </div>
          <button type="button" style={S.closeBtn} onClick={onClose} aria-label="Đóng">
            <IconX size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={S.body}>
          {err && (
            <div style={S.errBox}>
              <IconAlertCircle size={15} color="#c04938" />
              <span>{err}</span>
            </div>
          )}

          {/* Banner thông báo thông minh khi nút quà được chuyển lên dưới Gallery */}
          {isGiftRelocated ? (
            <div style={S.highlightCard}>
              <div style={S.highlightIcon}>✨</div>
              <div style={{ flex: 1 }}>
                <strong style={S.highlightTitle}>Nút GỬI QUÀ MỪNG đã chuyển lên dưới bộ ảnh cưới</strong>
                <p style={S.highlightText}>
                  Vì bạn đang tắt cả Xác nhận tham dự và Lời chúc, thiệp sẽ tự động di chuyển nút <strong>GỬI QUÀ MỪNG</strong> lên hiển thị ngay dưới bộ ảnh cưới (Gallery) đúng vị trí bạn mong muốn.
                </p>
              </div>
            </div>
          ) : showGiftBox ? (
            <div style={S.hintCard}>
              <span style={{ fontSize: 16 }}>💡</span>
              <p style={S.hintText}>
                <strong>Mẹo:</strong> Khi tắt cả <em>Xác nhận tham gia</em> và <em>Lời chúc</em>, nút <strong>GỬI QUÀ MỪNG</strong> sẽ tự động di chuyển lên hiển thị trang trọng ngay dưới album ảnh cưới (Gallery).
              </p>
            </div>
          ) : null}

          {/* Section 1: Xác Nhận Tham Gia (RSVP) */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeader}>
              <div style={S.sectionIconWrap}>
                <IconCheckSquare size={16} color="#342644" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={S.sectionTitle}>1. Xác Nhận Tham Gia (RSVP)</h4>
                <p style={S.sectionDesc}>Hỏi khách có thể tham dự hay không và lựa chọn số lượng người đi cùng</p>
              </div>
              <ToggleSwitch checked={showRsvp} onChange={() => setShowRsvp((v) => !v)} />
            </div>
            <div style={S.statusTagWrap}>
              <span style={showRsvp ? S.tagOn : S.tagOff}>
                {showRsvp ? '✓ Đang hiển thị câu hỏi tham dự & số lượng khách' : '✕ Đã tắt câu hỏi tham dự'}
              </span>
            </div>
          </div>

          {/* Section 2: Chức Năng Gửi Lời Chúc & Sổ Lưu Bút */}
          <div style={S.sectionCard}>
            <div style={S.sectionTitleRow}>
              <div style={S.sectionIconWrap}>
                <IconMessageCircle size={16} color="#342644" />
              </div>
              <div>
                <h4 style={S.sectionTitle}>2. Lời Chúc Phúc Từ Khách Mời</h4>
                <p style={S.sectionDesc}>Tùy chỉnh ô gửi lời chúc và danh sách lưu bút trên thiệp</p>
              </div>
            </div>

            <div style={S.subItemsList}>
              {/* 2a. Gửi lời chúc */}
              <div style={S.subItem}>
                <div style={{ flex: 1 }}>
                  <span style={S.subItemTitle}>Cho phép khách gửi lời chúc</span>
                  <p style={S.subItemDesc}>Hiển thị ô nhập lời chúc và nút gợi ý lời chúc hay</p>
                </div>
                <ToggleSwitch checked={allowWishes} onChange={() => setAllowWishes((v) => !v)} />
              </div>

              {/* 2b. Hiển thị sổ lưu bút */}
              <div style={S.subItem}>
                <div style={{ flex: 1 }}>
                  <span style={S.subItemTitle}>Hiển thị sổ lưu bút lời chúc</span>
                  <p style={S.subItemDesc}>Hiện danh sách các lời chúc đã được gửi lên thiệp cưới</p>
                </div>
                <ToggleSwitch checked={showWishesList} onChange={() => setShowWishesList((v) => !v)} />
              </div>
            </div>
          </div>

          {/* Section 3: Hộp Quà Mừng Cưới */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeader}>
              <div style={S.sectionIconWrap}>
                <IconCreditCard size={16} color="#342644" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={S.sectionTitle}>3. Hộp Quà Mừng Cưới</h4>
                <p style={S.sectionDesc}>Nút mở bảng thông tin số tài khoản và mã QR để khách mừng cưới từ xa</p>
              </div>
              <ToggleSwitch checked={showGiftBox} onChange={() => setShowGiftBox((v) => !v)} />
            </div>
            <div style={S.statusTagWrap}>
              <span style={showGiftBox ? S.tagOn : S.tagOff}>
                {showGiftBox
                  ? isGiftRelocated
                    ? '📍 Đang hiển thị dưới bộ ảnh Gallery'
                    : '✓ Đang hiển thị nút Gửi quà mừng'
                  : '✕ Đã ẩn nút Gửi quà mừng'}
              </span>
            </div>
          </div>

          {/* Section 4: Ảnh Nền Background */}
          <div style={S.sectionCard}>
            <div style={S.sectionTitleRow}>
              <div style={S.sectionIconWrap}>
                <IconImage size={16} color="#342644" />
              </div>
              <div>
                <h4 style={S.sectionTitle}>4. Tùy Biến Ảnh Nền Background</h4>
                <p style={S.sectionDesc}>Cài đặt ảnh nền cho toàn bộ thiệp cưới theo sở thích của bạn</p>
              </div>
            </div>

            {/* Preview Box */}
            <div style={S.bgPreviewBox}>
              {bgImage ? (
                <div style={S.bgActiveContainer}>
                  <div
                    style={{
                      ...S.bgThumb,
                      backgroundImage: `url("${toAbsoluteUrl(bgImage)}")`,
                    }}
                  />
                  <div style={S.bgMeta}>
                    <span style={S.bgMetaBadge}>✓ Đang áp dụng ảnh nền riêng</span>
                    <p style={S.bgMetaText}>Hình nền đã được phủ lớp nền mờ tinh tế giúp chữ và ảnh cưới luôn rõ nét.</p>
                    <div style={S.bgBtnRow}>
                      <button
                        type="button"
                        style={S.btnBgUpload}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <IconUploadCloud size={13} />
                        <span>{uploading ? 'Đang tải…' : 'Đổi ảnh khác'}</span>
                      </button>
                      <button
                        type="button"
                        style={S.btnBgReset}
                        onClick={() => setBgImage('')}
                      >
                        <IconTrash2 size={13} />
                        <span>Đặt lại nền mặc định</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={S.bgEmptyContainer}>
                  <div style={S.bgDefaultSwatch}>
                    <IconSparkles size={20} color="#b8896f" />
                  </div>
                  <div style={S.bgMeta}>
                    <span style={S.bgDefaultBadge}>Đang dùng nền mặc định của mẫu</span>
                    <p style={S.bgMetaText}>Chất giấy mỹ thuật ngà (Ivory) trang nhã kết hợp hoa cẩm tú cầu.</p>
                    <div style={S.bgBtnRow}>
                      <button
                        type="button"
                        style={S.btnBgUpload}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <IconUploadCloud size={14} />
                        <span>{uploading ? 'Đang tải…' : 'Tải ảnh nền mới'}</span>
                      </button>

                      {existingImages.length > 0 && (
                        <button
                          type="button"
                          style={S.btnBgPickAlbum}
                          onClick={() => setShowAlbumModal(true)}
                        >
                          <IconImage size={14} />
                          <span>Chọn từ album ảnh ({existingImages.length})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadBg}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={S.footer}>
          <button type="button" style={S.btnCancel} onClick={onClose} disabled={saving}>
            Đóng
          </button>
          <button type="button" style={S.btnSave} onClick={handleSave} disabled={saving}>
            <IconCheck size={16} />
            <span>{saving ? 'Đang lưu…' : 'Lưu & Áp Dụng Ngay'}</span>
          </button>
        </div>
      </div>

      {/* Album Picker Sub-modal */}
      {showAlbumModal && (
        <div style={S.modalOverlay}>
          <div style={S.modalCard}>
            <div style={S.modalHeader}>
              <h4 style={S.modalTitle}>Chọn ảnh làm nền từ Album</h4>
              <button
                type="button"
                style={S.closeBtn}
                onClick={() => setShowAlbumModal(false)}
              >
                <IconX size={16} />
              </button>
            </div>
            <div style={S.albumGrid}>
              {existingImages.map((img, idx) => (
                <div
                  key={img.id || idx}
                  style={S.albumThumbWrap}
                  onClick={() => {
                    setBgImage(img.image_url)
                    setShowAlbumModal(false)
                  }}
                  title="Bấm để chọn làm ảnh nền"
                >
                  <img
                    src={toAbsoluteUrl(img.image_url)}
                    alt={img.image_alt || 'Ảnh cưới'}
                    style={S.albumThumb}
                  />
                  <div style={S.albumThumbOverlay}>
                    <span>Chọn ảnh này</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        ...S.switchWrap,
        background: checked ? '#342644' : '#e2dbd3',
      }}
    >
      <span
        style={{
          ...S.switchThumb,
          transform: checked ? 'translateX(20px)' : 'translateX(2px)',
        }}
      />
    </button>
  )
}

const S = {
  wrap: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'flex-end',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(31, 25, 23, 0.65)',
    backdropFilter: 'blur(3px)',
  },
  drawer: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: 480,
    height: '100%',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-8px 0 28px rgba(0, 0, 0, 0.22)',
    animation: 'slideInRight 0.25s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #eee7de',
    background: '#fcfaf8',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: '#fdf0ea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1f1917',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#7a6f68',
    margin: '2px 0 0',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: '#f2ede7',
    color: '#5c524c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: '#f8f5f0',
  },
  errBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 8,
    background: '#fdf2f0',
    color: '#c04938',
    fontSize: 12.5,
    border: '1px solid #f6d1cb',
  },
  highlightCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 12,
    background: '#eaf6ee',
    border: '1px solid #b8e6c4',
    boxShadow: '0 2px 8px rgba(43, 122, 75, 0.08)',
  },
  highlightIcon: {
    fontSize: 20,
    lineHeight: 1,
    flexShrink: 0,
  },
  highlightTitle: {
    fontSize: 13,
    color: '#1e683b',
    display: 'block',
    marginBottom: 4,
  },
  highlightText: {
    fontSize: 12,
    color: '#2a5a3a',
    margin: 0,
    lineHeight: 1.45,
  },
  hintCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    background: '#ffffff',
    border: '1px dashed #d9cebe',
  },
  hintText: {
    fontSize: 12,
    color: '#6e625c',
    margin: 0,
    lineHeight: 1.45,
  },
  sectionCard: {
    background: '#ffffff',
    borderRadius: 14,
    padding: '16px',
    border: '1px solid #ede5db',
    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: '#f2ece4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#1f1917',
    margin: 0,
  },
  sectionDesc: {
    fontSize: 11.5,
    color: '#7a6f68',
    margin: '2px 0 0',
    lineHeight: 1.35,
  },
  statusTagWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid #f6f1ea',
  },
  tagOn: {
    fontSize: 11,
    fontWeight: 600,
    color: '#2b7a4b',
    background: '#e8f5ed',
    padding: '3px 8px',
    borderRadius: 6,
    display: 'inline-block',
  },
  tagOff: {
    fontSize: 11,
    fontWeight: 600,
    color: '#8c7e75',
    background: '#f2ede7',
    padding: '3px 8px',
    borderRadius: 6,
    display: 'inline-block',
  },
  subItemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingTop: 6,
    borderTop: '1px solid #f6f1ea',
  },
  subItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0',
  },
  subItemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#2c2523',
    display: 'block',
  },
  subItemDesc: {
    fontSize: 11.5,
    color: '#7a6f68',
    margin: '2px 0 0',
  },
  switchWrap: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'background 0.2s ease',
    flexShrink: 0,
    padding: 0,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#ffffff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s ease',
  },
  bgPreviewBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: '#faf7f2',
    border: '1px solid #eee5dc',
  },
  bgActiveContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  bgThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '1.5px solid #d9cebe',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    flexShrink: 0,
  },
  bgEmptyContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  bgDefaultSwatch: {
    width: 76,
    height: 76,
    borderRadius: 10,
    background: 'radial-gradient(circle, #ffffff 0%, #f6efe6 100%)',
    border: '1px dashed #c9b592',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bgMeta: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  bgMetaBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#2b7a4b',
  },
  bgDefaultBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: '#8a6b45',
  },
  bgMetaText: {
    fontSize: 11.5,
    color: '#7a6f68',
    margin: 0,
    lineHeight: 1.35,
  },
  bgBtnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  btnBgUpload: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 11.5,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid #d9cebe',
    background: '#ffffff',
    color: '#1f1917',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  btnBgPickAlbum: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 11.5,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid #d9cebe',
    background: '#f8f5f0',
    color: '#342644',
    cursor: 'pointer',
  },
  btnBgReset: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 8,
    border: '1px solid #f0d5ce',
    background: '#fff5f3',
    color: '#c04938',
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 20px',
    borderTop: '1px solid #eee7de',
    background: '#fcfaf8',
  },
  btnCancel: {
    padding: '9px 18px',
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 10,
    border: '1px solid #d9cebe',
    background: '#ffffff',
    color: '#5c524c',
    cursor: 'pointer',
  },
  btnSave: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(201, 101, 71, 0.25)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10001,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    background: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '80vh',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #eee',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 700,
    margin: 0,
    color: '#1f1917',
  },
  albumGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    padding: 16,
    overflowY: 'auto',
  },
  albumThumbWrap: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    border: '1px solid #ddd',
  },
  albumThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  albumThumbOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(52, 38, 68, 0.6)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.2s',
  },
}

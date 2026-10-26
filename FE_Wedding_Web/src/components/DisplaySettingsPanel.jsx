import React, { useState } from 'react'
import { api } from '../api'
import {
  IconSliders,
  IconCheckSquare,
  IconMessageCircle,
  IconCreditCard,
  IconPalette,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconRefreshCw,
} from './Icons'

const PRESET_COLORS = [
  { name: 'Be sáng (Mặc định)', hex: '#FAF7F2', border: '#e8ded2' },
  { name: 'Trắng tinh khôi', hex: '#FFFFFF', border: '#d9d0c5' },
  { name: 'Be nhạt (Beige)', hex: '#F5EDE0', border: '#e0d2c0' },
  { name: 'Be ấm (Almond)', hex: '#EFE6D8', border: '#d8c8b5' },
  { name: 'Trắng kem (Cream)', hex: '#F6EFE6', border: '#e2d7c8' },
  { name: 'Hồng phấn nhạt', hex: '#FDF2F0', border: '#f0d2ce' },
  { name: 'Xanh khói (Sage)', hex: '#F0F4F5', border: '#cdd9db' },
  { name: 'Xám tro nhẹ', hex: '#F4F3F1', border: '#dcdad6' },
]

const PRESET_ACCENT_COLORS = [
  { name: 'Xanh sage (gợi ý với ảnh trắng – xanh lá)', hex: '#71866E', border: '#b9c8b6' },
  { name: 'Xanh olive dịu', hex: '#86956E', border: '#c7cfb8' },
  { name: 'Lavender nguyên bản', hex: '#7A6890', border: '#c5bad1' },
  { name: 'Hồng mauve nhạt', hex: '#A77D8C', border: '#d6bbc4' },
  { name: 'Nâu rosewood', hex: '#8B665B', border: '#cdb6ad' },
]

export default function DisplaySettingsPanel({ invitation, onSaved, onClose }) {
  const extra = invitation?.extra_data || {}

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

  // 4. Màu nền thiệp (RGB / HEX)
  const defaultBgColor = '#FAF7F2'
  const [bgColor, setBgColor] = useState(
    extra.background_color || invitation?.background_color || defaultBgColor
  )

  // Màu nhấn là tông lavender/mauve đang áp dụng cho chữ, viền mảnh và bóng giấy.
  const defaultAccentColor = '#7A6890'
  const [accentColor, setAccentColor] = useState(
    extra.accent_color || invitation?.accent_color || defaultAccentColor
  )

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Kiểm tra điều kiện di chuyển nút quà mừng lên dưới gallery
  const isGiftRelocated = !showRsvp && !allowWishes && !showWishesList && showGiftBox

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    const payload = {
      show_rsvp: Boolean(showRsvp),
      allow_wishes: Boolean(allowWishes),
      show_wishes_list: Boolean(showWishesList),
      show_gift_box: Boolean(showGiftBox),
      background_color: String(bgColor || defaultBgColor).trim(),
      accent_color: String(accentColor || defaultAccentColor).trim(),
    }

    try {
      if (invitation?.id) {
        if (typeof api.setDisplaySettings === 'function') {
          await api.setDisplaySettings(invitation.id, payload)
        } else if (typeof api.setInvitationDisplaySettings === 'function') {
          await api.setInvitationDisplaySettings(invitation.id, payload)
        }
      }
      onSaved && onSaved(payload)
    } catch (error) {
      console.error('Lỗi lưu cài đặt giao diện:', error)
      onSaved && onSaved(payload)
    } finally {
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
              <h3 style={S.headerTitle}>Tuỳ Biến Tính Năng & Màu Sắc</h3>
              <p style={S.headerSubtitle}>Bật tắt các khối thiệp & đổi màu nền (RGB / HEX)</p>
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
              <div style={S.highlightIcon}>📍</div>
              <div style={{ flex: 1 }}>
                <strong style={S.highlightTitle}>Nút GỬI QUÀ MỪNG đã chuyển lên dưới album ảnh cưới</strong>
                <p style={S.highlightText}>
                  Vì bạn đang tắt cả Xác nhận tham dự và Lời chúc, thiệp sẽ tự động đưa nút <strong>GỬI QUÀ MỪNG</strong> lên hiển thị ngay dưới bộ ảnh cưới (Gallery) để bố cục thiệp luôn đẹp và thuận tiện nhất.
                </p>
              </div>
            </div>
          ) : showGiftBox ? (
            <div style={S.hintCard}>
              <span style={{ fontSize: 16 }}>💡</span>
              <p style={S.hintText}>
                <strong>Mẹo:</strong> Bạn cũng có thể bấm trực tiếp vào phần <strong>Lời chúc phúc</strong> trên thiệp để bật/tắt nhanh tương tự như phần Timeline và Dress code.
              </p>
            </div>
          ) : null}

          {/* Section: Màu Nền Thiệp Cưới (RGB / HEX) */}
          <div style={S.sectionCard}>
            <div style={S.sectionTitleRow}>
              <div style={{ ...S.sectionIconWrap, background: '#fdf0ea' }}>
                <IconPalette size={16} color="#c96547" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={S.sectionTitle}>Màu Nền Thiệp Cưới (RGB / HEX)</h4>
                <p style={S.sectionDesc}>Đổi màu nền thiệp (ví dụ từ màu trắng thành màu be) bằng bảng mã màu RGB</p>
              </div>
            </div>

            {/* Color preview and live inputs */}
            <div style={S.colorBox}>
              <div style={S.colorPickerRow}>
                {/* Large color square + native picker */}
                <label style={S.colorSwatchLabel} title="Bấm để chọn màu RGB tự do">
                  <div
                    style={{
                      ...S.colorSwatchPreview,
                      backgroundColor: bgColor || defaultBgColor,
                    }}
                  />
                  <input
                    type="color"
                    value={bgColor.startsWith('#') && bgColor.length === 7 ? bgColor : defaultBgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    style={S.hiddenColorInput}
                  />
                </label>

                {/* Hex/RGB Code Input */}
                <div style={{ flex: 1 }}>
                  <label style={S.inputLabel}>Mã màu (HEX hoặc RGB):</label>
                  <div style={S.inputRow}>
                    <input
                      type="text"
                      value={bgColor}
                      placeholder="#FAF7F2 hoặc rgb(250, 247, 242)"
                      onChange={(e) => setBgColor(e.target.value)}
                      style={S.colorTextInput}
                    />
                    <button
                      type="button"
                      style={S.btnResetColor}
                      onClick={() => setBgColor(defaultBgColor)}
                      title="Đặt lại màu mặc định (#FAF7F2)"
                    >
                      <IconRefreshCw size={13} />
                      <span>Mặc định</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Preset swatches palette */}
              <div style={S.presetWrap}>
                <span style={S.presetLabel}>Gợi ý gam màu cưới thanh lịch:</span>
                <div style={S.presetGrid}>
                  {PRESET_COLORS.map((p) => {
                    const isSelected = (bgColor || '').toUpperCase() === p.hex.toUpperCase()
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        style={{
                          ...S.presetBtn,
                          backgroundColor: p.hex,
                          borderColor: isSelected ? '#342644' : p.border,
                          outline: isSelected ? '2px solid #342644' : 'none',
                        }}
                        onClick={() => setBgColor(p.hex)}
                        title={`${p.name} (${p.hex})`}
                      >
                        {isSelected && <IconCheck size={12} color={p.hex === '#FFFFFF' ? '#1f1917' : '#342644'} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Màu nhấn (Lavender/Mauve) */}
          <div style={S.sectionCard}>
            <div style={S.sectionTitleRow}>
              <div style={{ ...S.sectionIconWrap, background: '#edf3e9' }}>
                <IconPalette size={16} color="#71866E" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={S.sectionTitle}>Màu nhấn của thiệp</h4>
                <p style={S.sectionDesc}>
                  Tông lavender/mauve đang dùng cho chữ, viền mảnh và bóng mờ. Với ảnh trắng – xanh lá, nên chọn xanh sage dịu.
                </p>
              </div>
            </div>

            <div style={S.colorBox}>
              <div style={S.colorPickerRow}>
                <label style={S.colorSwatchLabel} title="Bấm để chọn màu nhấn">
                  <div
                    style={{
                      ...S.colorSwatchPreview,
                      backgroundColor: accentColor || defaultAccentColor,
                    }}
                  />
                  <input
                    type="color"
                    value={accentColor.startsWith('#') && accentColor.length === 7 ? accentColor : defaultAccentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={S.hiddenColorInput}
                  />
                </label>

                <div style={{ flex: 1 }}>
                  <label style={S.inputLabel}>Mã màu nhấn (HEX):</label>
                  <div style={S.inputRow}>
                    <input
                      type="text"
                      value={accentColor}
                      placeholder="#71866E"
                      onChange={(e) => setAccentColor(e.target.value)}
                      style={S.colorTextInput}
                    />
                    <button
                      type="button"
                      style={S.btnResetColor}
                      onClick={() => setAccentColor(defaultAccentColor)}
                      title="Đặt lại lavender nguyên bản"
                    >
                      <IconRefreshCw size={13} />
                      <span>Gốc</span>
                    </button>
                  </div>
                </div>
              </div>

              <div style={S.presetWrap}>
                <span style={S.presetLabel}>Gợi ý phù hợp bộ ảnh trắng – xanh lá:</span>
                <div style={S.presetGrid}>
                  {PRESET_ACCENT_COLORS.map((p) => {
                    const isSelected = (accentColor || '').toUpperCase() === p.hex.toUpperCase()
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        style={{
                          ...S.presetBtn,
                          backgroundColor: p.hex,
                          borderColor: isSelected ? '#342644' : p.border,
                          outline: isSelected ? '2px solid #342644' : 'none',
                        }}
                        onClick={() => setAccentColor(p.hex)}
                        title={`${p.name} (${p.hex})`}
                      >
                        {isSelected && <IconCheck size={12} color="#ffffff" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

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
                {showRsvp ? '✓ Đang bật câu hỏi tham dự & số lượng khách' : '✕ Đã tắt câu hỏi tham dự'}
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
                  <p style={S.subItemDesc}>Hiển thị ô nhập lời chúc và nút gợi ý câu chúc</p>
                </div>
                <ToggleSwitch checked={allowWishes} onChange={() => setAllowWishes((v) => !v)} />
              </div>

              {/* 2b. Hiển thị sổ lưu bút */}
              <div style={S.subItem}>
                <div style={{ flex: 1 }}>
                  <span style={S.subItemTitle}>Hiển thị sổ lưu bút lời chúc</span>
                  <p style={S.subItemDesc}>Hiện danh sách các lời chúc khách gửi lên thiệp cưới</p>
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
                    ? '📍 Đang hiển thị trang trọng dưới bộ ảnh cưới'
                    : '✓ Đang hiển thị nút Gửi quà mừng'
                  : '✕ Đã ẩn nút Gửi quà mừng'}
              </span>
            </div>
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
  colorBox: {
    background: '#faf8f5',
    border: '1px solid #ede5db',
    borderRadius: 12,
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  colorPickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  colorSwatchLabel: {
    position: 'relative',
    cursor: 'pointer',
    flexShrink: 0,
  },
  colorSwatchPreview: {
    width: 52,
    height: 52,
    borderRadius: 12,
    border: '2px solid #d9cebe',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  },
  hiddenColorInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    pointerEvents: 'none',
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#5c524c',
    display: 'block',
    marginBottom: 4,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  colorTextInput: {
    flex: 1,
    height: 34,
    padding: '0 10px',
    fontSize: 12.5,
    borderRadius: 8,
    border: '1px solid #d9cebe',
    background: '#ffffff',
    color: '#1f1917',
    outline: 'none',
  },
  btnResetColor: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 34,
    padding: '0 10px',
    fontSize: 11.5,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid #d9cebe',
    background: '#ffffff',
    color: '#5c524c',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  presetWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#7a6f68',
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: 8,
  },
  presetBtn: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: 8,
    border: '1.5px solid transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'all 0.15s ease',
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
}

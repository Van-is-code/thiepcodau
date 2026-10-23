import React, { useRef } from 'react'
import { IconCheck, IconImage, IconPlus, IconUploadCloud, IconX } from './Icons'

function formatRatio(r) {
  if (!r || r <= 0) return 'Tự do'
  const known = { 1: '1:1 (Vuông)', 0.75: '3:4 (Dọc)', 1.333: '4:3 (Ngang)', 0.5625: '9:16 (Dọc đứng)', 1.777: '16:9 (Ngang)', 0.667: '2:3 (Dọc)', 1.5: '3:2 (Ngang)' }
  const hit = Object.keys(known).find((k) => Math.abs(Number(k) - r) < 0.04)
  return hit ? known[hit] : `${r.toFixed(2)}:1`
}

function getSlotTitle(slot, index) {
  if (slot === 'cover') return 'Ảnh bìa thiệp cưới'
  if (slot === 'groom') return 'Ảnh chú rể'
  if (slot === 'bride') return 'Ảnh cô dâu'
  if (slot === 'story') return 'Ảnh chuyện tình yêu (Story)'
  if (slot === 'gallery') return `Ảnh kỷ niệm ${index !== null && index !== undefined ? `#${Number(index) + 1}` : ''}`
  return `Ảnh ${slot}`
}

function getSlotBadge(img) {
  if (img.image_type === 'cover') return 'Bìa'
  if (img.image_type === 'groom') return 'Chú rể'
  if (img.image_type === 'bride') return 'Cô dâu'
  if (img.image_type === 'story') return 'Story'
  if (img.image_type === 'gallery') return `Album #${(img.sort_order || 0) + 1}`
  return img.image_type || ''
}

export default function ImagePickerModal({
  slot,
  index,
  ratio,
  existingImages = [],
  onSelectExisting,
  onUploadNew,
  onClose,
}) {
  const fileInputRef = useRef(null)

  // Lọc danh sách ảnh đã tải lên, loại bỏ mã QR ngân hàng và trùng lặp theo image_url
  const seenUrls = new Set()
  const mediaLibrary = existingImages.filter((img) => {
    if (!img || !img.image_url) return false
    if (img.image_type === 'bank_qr') return false
    if (seenUrls.has(img.image_url)) return false
    seenUrls.add(img.image_url)
    return true
  })

  // Kiểm tra xem ảnh nào hiện đang được gán cho đúng ô này
  const currentSlotImage = existingImages.find((img) => {
    if (img.image_type !== slot) return false
    if (index !== null && index !== undefined) {
      return (img.sort_order || 0) === Number(index)
    }
    return true
  })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      e.target.value = ''
      onUploadNew(file)
    }
  }

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.box}>
        {/* Header */}
        <div style={S.head}>
          <div>
            <div style={S.title}>
              <IconImage size={18} style={{ color: '#c96547' }} />
              <span>{getSlotTitle(slot, index)}</span>
            </div>
            <div style={S.sub}>
              Tỉ lệ đề xuất: <strong>{formatRatio(ratio)}</strong>. Bạn có thể chọn ảnh có sẵn hoặc tải ảnh mới.
            </div>
          </div>
          <button style={S.close} onClick={onClose} title="Đóng">
            <IconX size={18} />
          </button>
        </div>

        {/* Action Button: Tải ảnh mới */}
        <div style={S.body}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            type="button"
            style={S.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={S.uploadIconWrap}>
              <IconUploadCloud size={24} />
            </div>
            <div>
              <div style={S.uploadMainText}>Tải ảnh mới từ thiết bị</div>
              <div style={S.uploadSubText}>Chọn ảnh từ máy tính hoặc điện thoại để cắt vừa khung</div>
            </div>
          </button>

          {/* Danh sách ảnh đã có */}
          <div style={S.sectionDivider}>
            <span style={S.sectionLabel}>
              Hoặc chọn từ ảnh bạn đã tải lên ({mediaLibrary.length})
            </span>
          </div>

          {mediaLibrary.length === 0 ? (
            <div style={S.emptyBox}>
              <IconImage size={32} style={{ color: '#c9b592', marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: '#6e625c', fontWeight: 600 }}>Chưa có ảnh nào được tải lên trước đó</div>
              <div style={{ fontSize: 12, color: '#9a8a76', marginTop: 4 }}>
                Bấm vào nút trên để tải bức ảnh đầu tiên từ máy của bạn.
              </div>
            </div>
          ) : (
            <div style={S.grid}>
              {mediaLibrary.map((img) => {
                const isCurrent = currentSlotImage && currentSlotImage.image_url === img.image_url
                const badge = getSlotBadge(img)
                return (
                  <div
                    key={img.id || img.image_url}
                    style={{
                      ...S.gridItem,
                      ...(isCurrent ? S.gridItemActive : {}),
                    }}
                    onClick={() => onSelectExisting(img)}
                    title={`Chọn ảnh này (${badge})`}
                  >
                    <img src={img.image_url} alt="" style={S.thumbImg} loading="lazy" />
                    {badge && <span style={S.badge}>{badge}</span>}
                    {isCurrent && (
                      <div style={S.activeBadge}>
                        <IconCheck size={14} />
                      </div>
                    )}
                    <div style={S.itemOverlay}>
                      <span>Chọn ảnh</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button type="button" style={S.btnCancel} onClick={onClose}>
            Huỷ bỏ
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(31,25,23,0.6)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 9600,
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
  },
  box: {
    width: 'min(520px, 100%)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '20px 24px 14px',
    borderBottom: '1px solid #ede5db',
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1f1917',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sub: {
    fontSize: 12.5,
    color: '#6e625c',
    marginTop: 4,
    lineHeight: 1.5,
  },
  close: {
    background: '#f6f1eb',
    border: '1px solid #ede5db',
    borderRadius: 10,
    padding: 7,
    cursor: 'pointer',
    color: '#6e625c',
    display: 'flex',
    flexShrink: 0,
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  uploadBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 18px',
    borderRadius: 14,
    border: '2px dashed #c96547',
    background: '#fff8f5',
    color: '#1f1917',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all .2s ease',
  },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  uploadMainText: {
    fontSize: 14,
    fontWeight: 700,
    color: '#c96547',
  },
  uploadSubText: {
    fontSize: 12,
    color: '#7a6a60',
    marginTop: 2,
  },
  sectionDivider: {
    margin: '22px 0 14px',
    display: 'flex',
    alignItems: 'center',
    textAlign: 'center',
    borderBottom: '1px solid #ede5db',
    lineHeight: '0.1em',
  },
  sectionLabel: {
    background: '#fff',
    padding: '0 12px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#8a7a6f',
  },
  emptyBox: {
    padding: '32px 16px',
    textAlign: 'center',
    background: '#faf7f2',
    borderRadius: 14,
    border: '1px solid #ede5db',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  gridItem: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: 12,
    overflow: 'hidden',
    border: '2px solid #ede5db',
    background: '#f2ede7',
    cursor: 'pointer',
    transition: 'all .2s ease',
  },
  gridItemActive: {
    borderColor: '#c96547',
    boxShadow: '0 0 0 2px rgba(201,101,71,0.3)',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    fontSize: 10,
    fontWeight: 600,
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: 6,
    backdropFilter: 'blur(2px)',
    pointerEvents: 'none',
  },
  activeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#c96547',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
  },
  itemOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(201,101,71,0.85)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    opacity: 0,
    transition: 'opacity .18s ease',
    pointerEvents: 'none',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '12px 24px 16px',
    borderTop: '1px solid #ede5db',
    background: '#faf7f2',
    flexShrink: 0,
  },
  btnCancel: {
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 10,
    border: '1px solid #d8ccbe',
    background: '#fff',
    color: '#4a3f39',
    cursor: 'pointer',
  },
}


import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { toAbsoluteMediaUrl } from '../lib/templateEngine'
import {
  IconPalette,
  IconX,
  IconCheck,
  IconSparkles,
  IconRefreshCw,
  IconAlertCircle,
  IconMusic,
  IconEye,
} from './Icons'

export default function ChangeTemplateModal({
  isOpen,
  onClose,
  currentTemplateId,
  invitationId,
  onSuccess,
}) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(currentTemplateId || '')
  const [isChanging, setIsChanging] = useState(false)
  const [changeError, setChangeError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let active = true

    const fetchTemplates = async () => {
      setLoading(true)
      setError('')
      setChangeError('')
      try {
        const res = await api.getTemplates()
        const items = (res.data?.data?.items || res.data?.data || res.data || []).filter(Boolean)
        if (active) {
          setTemplates(items)
          // Default selection: if currentTemplateId exists, keep it or choose first available
          if (currentTemplateId) {
            setSelectedId(currentTemplateId)
          } else if (items.length > 0) {
            setSelectedId(items[0].id)
          }
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.message || err.message || 'Không thể tải danh sách mẫu thiệp')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchTemplates()
    return () => { active = false }
  }, [isOpen, currentTemplateId])

  if (!isOpen) return null

  const selectedTemplate = templates.find((t) => String(t.id) === String(selectedId))
  const isCurrentTemplate = String(selectedId) === String(currentTemplateId)

  const handleConfirmChange = async () => {
    if (!selectedTemplate || isCurrentTemplate || isChanging) return
    setIsChanging(true)
    setChangeError('')
    try {
      await api.changeInvitationTemplate(invitationId, selectedTemplate.id)
      if (onSuccess) {
        onSuccess(selectedTemplate)
      } else {
        window.location.reload()
      }
    } catch (err) {
      setChangeError(err?.response?.data?.message || err.message || 'Đổi mẫu thất bại. Vui lòng thử lại.')
      setIsChanging(false)
    }
  }

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !isChanging) onClose() }}>
      <div style={styles.modal} role="dialog" aria-modal="true">
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.iconWrap}>
              <IconPalette size={20} color="#d97757" />
            </div>
            <div>
              <div style={styles.title}>Đổi Mẫu Thiệp Cưới</div>
              <div style={styles.subtitle}>
                Đổi mẫu <strong>KHÔNG</strong> tính vào lượt sửa (được đổi thoải mái cho tới khi thiệp bị khoá).
              </div>
            </div>
          </div>
          <button
            type="button"
            style={styles.closeBtn}
            onClick={onClose}
            disabled={isChanging}
            aria-label="Đóng"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Notice Banner */}
        <div style={styles.noticeBanner}>
          <IconSparkles size={16} color="#d97757" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Chọn mẫu thiệp bạn yêu thích bên dưới. Toàn bộ hình ảnh, thông tin cô dâu chú rể và lời nhắn đã nhập sẽ tự động chuyển sang mẫu mới.
          </span>
        </div>

        {/* Body content */}
        <div style={styles.body}>
          {loading && (
            <div style={styles.loadingBox}>
              <IconRefreshCw size={24} color="#d97757" className="spin-icon" />
              <span style={{ fontSize: 13, color: '#666' }}>Đang tải danh sách mẫu thiệp...</span>
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              <IconAlertCircle size={18} color="#c04938" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && templates.length === 0 && (
            <div style={styles.emptyBox}>Chưa có mẫu nào khác để lựa chọn.</div>
          )}

          {!loading && !error && templates.length > 0 && (
            <div style={styles.grid}>
              {templates.map((tpl) => {
                const isSelected = String(tpl.id) === String(selectedId)
                const isCurrent = String(tpl.id) === String(currentTemplateId)
                const thumbUrl = tpl.thumbnail_url ? toAbsoluteMediaUrl(tpl.thumbnail_url) : ''

                return (
                  <div
                    key={tpl.id}
                    style={{
                      ...styles.card,
                      ...(isSelected ? styles.cardSelected : {}),
                      ...(isCurrent ? styles.cardCurrent : {}),
                    }}
                    onClick={() => {
                      if (!isChanging) setSelectedId(tpl.id)
                    }}
                  >
                    {/* Thumbnail preview */}
                    <div style={styles.cardThumbBox}>
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={tpl.template_name}
                          style={styles.cardThumbImg}
                          loading="lazy"
                        />
                      ) : (
                        <div style={styles.cardThumbPlaceholder}>
                          <IconPalette size={32} color="#a89b91" />
                        </div>
                      )}

                      {/* Top Badges */}
                      <div style={styles.thumbBadges}>
                        {isCurrent && (
                          <span style={styles.currentBadge}>
                            <IconCheck size={11} />
                            Đang Dùng
                          </span>
                        )}
                        {tpl.has_music_box && (
                          <span style={styles.musicBadge} title="Mẫu này hỗ trợ hộp nhạc nền">
                            <IconMusic size={11} />
                            Hộp nhạc
                          </span>
                        )}
                      </div>

                      {/* Radio Selection Indicator */}
                      <div style={{
                        ...styles.radioIndicator,
                        ...(isSelected ? styles.radioIndicatorSelected : {}),
                      }}>
                        {isSelected && <div style={styles.radioInnerDot} />}
                      </div>
                    </div>

                    {/* Card Details */}
                    <div style={styles.cardDetails}>
                      <div style={styles.cardTitleRow}>
                        <h4 style={styles.cardTitle}>{tpl.template_name || tpl.template_code}</h4>
                      </div>
                      <p style={styles.cardDesc}>
                        {tpl.description || 'Thiết kế tinh tế chuẩn 9:16 cho thiết bị di động.'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Change error if any */}
        {changeError && (
          <div style={styles.actionError}>
            <IconAlertCircle size={15} color="#c04938" />
            <span>{changeError}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div style={styles.footer}>
          <div style={styles.footerInfo}>
            {selectedTemplate && (
              <span style={styles.selectedHint}>
                Đang chọn: <strong>{selectedTemplate.template_name || selectedTemplate.template_code}</strong>
                {isCurrentTemplate && ' (mẫu hiện tại)'}
              </span>
            )}
          </div>
          <div style={styles.footerButtons}>
            <button
              type="button"
              style={styles.cancelBtn}
              onClick={onClose}
              disabled={isChanging}
            >
              Huỷ
            </button>
            <button
              type="button"
              style={{
                ...styles.submitBtn,
                ...(isCurrentTemplate || !selectedTemplate || isChanging ? styles.submitBtnDisabled : {}),
              }}
              onClick={handleConfirmChange}
              disabled={isCurrentTemplate || !selectedTemplate || isChanging}
            >
              {isChanging ? (
                <>
                  <IconRefreshCw size={15} className="spin-icon" />
                  <span>Đang Đổi Mẫu...</span>
                </>
              ) : isCurrentTemplate ? (
                <span>Đang Sử Dụng Mẫu Này</span>
              ) : (
                <>
                  <IconPalette size={15} />
                  <span>Đổi Sang Mẫu Này</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    animation: 'fadeIn 0.2s ease-out',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.06)',
    width: '100%',
    maxWidth: 680,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid #f0ece6',
  },
  headerLeft: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(217, 119, 87, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 1.45,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    width: 32,
    height: 32,
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    transition: 'all 0.15s ease',
  },
  noticeBanner: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#fffaf5',
    borderBottom: '1px solid #fed7aa',
    padding: '10px 24px',
    fontSize: 12.5,
    color: '#9a3412',
    lineHeight: 1.45,
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
    minHeight: 200,
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '60px 0',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '14px 18px',
    borderRadius: 10,
    fontSize: 13,
  },
  emptyBox: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#64748b',
    fontSize: 14,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    border: '2px solid #e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#d97757',
    boxShadow: '0 8px 24px rgba(217, 119, 87, 0.18)',
    backgroundColor: '#fffdfb',
  },
  cardCurrent: {
    borderColor: '#cbd5e1',
  },
  cardThumbBox: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    borderBottom: '1px solid #f1f5f9',
  },
  cardThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.35s ease',
  },
  cardThumbPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  thumbBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    display: 'flex',
    gap: 6,
    zIndex: 2,
  },
  currentBadge: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '3px 8px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
  },
  musicBadge: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    backdropFilter: 'blur(4px)',
  },
  radioIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '2px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    zIndex: 2,
    transition: 'all 0.2s ease',
  },
  radioIndicatorSelected: {
    borderColor: '#d97757',
    backgroundColor: '#ffffff',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#d97757',
  },
  cardDetails: {
    padding: '14px 16px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  cardTitleRow: {
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
    lineHeight: 1.3,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  actionError: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '10px 24px',
    fontSize: 12.5,
    borderTop: '1px solid #fee2e2',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderTop: '1px solid #f0ece6',
    backgroundColor: '#faf8f5',
    gap: 12,
    flexWrap: 'wrap',
  },
  footerInfo: {
    flex: 1,
    minWidth: 180,
  },
  selectedHint: {
    fontSize: 13,
    color: '#475569',
  },
  footerButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    padding: '9px 18px',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#475569',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  submitBtn: {
    padding: '9px 22px',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    border: 'none',
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: 700,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 4px 14px rgba(217, 119, 87, 0.3)',
    transition: 'all 0.2s ease',
  },
  submitBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
}


import React, { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../api'
import {
  IconX,
  IconCheck,
  IconAlertCircle,
  IconRefreshCw,
  IconSparkles,
  IconHeart,
  IconSend,
} from './Icons'

const removeDiacriticsVi = (str) => {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

const cleanSlug = (str) => {
  return removeDiacriticsVi(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}

const generateRandomSlug = () => `thiep-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function ChangeSlugModal({ isOpen, onClose, invitation, onSlugChanged }) {
  const [activeTab, setActiveTab] = useState('custom') // 'custom' | 'couple' | 'random'
  const [slugInput, setSlugInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const debounceRef = useRef(null)

  const currentSlug = invitation?.invitation_slug || invitation?.slug || ''

  // Tên dâu rể rút gọn
  const coupleCandidates = useMemo(() => {
    const groomName = invitation?.groom?.name_groom || ''
    const brideName = invitation?.bride?.name_bride || ''

    const groomShort = groomName.trim().split(' ').pop() || ''
    const brideShort = brideName.trim().split(' ').pop() || ''

    const gClean = cleanSlug(groomShort)
    const bClean = cleanSlug(brideShort)
    const year = new Date().getFullYear()

    if (!gClean && !bClean) return []

    const list = []
    if (gClean && bClean) {
      list.push(`${gClean}-${bClean}`)
      list.push(`${gClean}-va-${bClean}`)
      list.push(`dam-cuoi-${gClean}-${bClean}`)
      list.push(`${gClean}-${bClean}-${year}`)
    } else {
      const single = gClean || bClean
      list.push(`dam-cuoi-${single}`)
      list.push(`${single}-${year}`)
    }
    return [...new Set(list)]
  }, [invitation])

  useEffect(() => {
    if (isOpen) {
      setSlugInput(currentSlug)
      setCheckResult({ available: true, slug: currentSlug, suggested: null })
      setSaveSuccess(false)
      setSaveError('')
      setActiveTab('custom')
    }
  }, [isOpen, currentSlug])

  // Kiểm tra tính khả dụng của slug
  const checkAvailability = async (slugToCheck) => {
    const cleaned = cleanSlug(slugToCheck)
    if (!cleaned) {
      setCheckResult(null)
      return
    }
    if (cleaned === currentSlug) {
      setCheckResult({ available: true, slug: cleaned, suggested: null, message: 'Đường dẫn hiện tại của thiệp' })
      return
    }

    setChecking(true)
    try {
      const res = await api.checkInvitationSlug(invitation.id, cleaned)
      const data = res.data?.data || res.data
      setCheckResult(data)
    } catch (_err) {
      setCheckResult({
        available: false,
        slug: cleaned,
        suggested: `${cleaned}-${new Date().getFullYear()}`,
        message: 'Lỗi khi kiểm tra. Bạn có thể sử dụng đuôi gợi ý.'
      })
    } finally {
      setChecking(false)
    }
  }

  // Khi gõ ô custom slug
  const handleInputChange = (e) => {
    const raw = e.target.value
    setSlugInput(raw)
    setSaveError('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      checkAvailability(raw)
    }, 400)
  }

  // Chọn 1 candidate từ Couple
  const handleSelectCoupleCandidate = (candidate) => {
    setSlugInput(candidate)
    checkAvailability(candidate)
  }

  // Tạo random slug mới
  const handleGenerateRandom = () => {
    const rnd = generateRandomSlug()
    setSlugInput(rnd)
    checkAvailability(rnd)
  }

  // Áp dụng đuôi gợi ý khi bị trùng
  const handleApplySuggested = () => {
    if (checkResult?.suggested) {
      setSlugInput(checkResult.suggested)
      checkAvailability(checkResult.suggested)
    }
  }

  // Lưu slug
  const handleSave = async () => {
    const cleaned = cleanSlug(slugInput)
    if (!cleaned) {
      setSaveError('Vui lòng nhập đường dẫn hợp lệ')
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      const res = await api.setInvitationSlug(invitation.id, cleaned)
      const data = res.data?.data || res.data
      const finalSlug = data?.invitation_slug || cleaned
      setSaveSuccess(true)
      if (onSlugChanged) {
        onSlugChanged(finalSlug)
      }
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err) {
      setSaveError(err?.response?.data?.message || err.message || 'Lỗi khi lưu đường dẫn')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const activeCleanSlug = cleanSlug(slugInput)
  const isDuplicate = checkResult && checkResult.available === false
  const isAvailable = checkResult && checkResult.available === true
  const suggestedSlug = checkResult?.suggested

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 25, 23, 0.55)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 22,
          maxWidth: 540,
          width: '100%',
          boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #f0eae4',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: 'linear-gradient(180deg, #faf7f5 0%, #fff 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔗</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#2c221e' }}>
                Tuỳ Chỉnh Đường Dẫn Thiệp (Slug)
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#776c66', lineHeight: 1.4 }}>
              Chọn phương án tạo link đẹp mắt, không lo trùng tên và tự động rút gọn link mời riêng.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f4ede6',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#554a44',
            }}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ padding: '16px 24px 0' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              background: '#f4ede7',
              borderRadius: 12,
              padding: 4,
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              style={{
                border: 'none',
                padding: '8px 10px',
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: activeTab === 'custom' ? 700 : 500,
                background: activeTab === 'custom' ? '#fff' : 'transparent',
                color: activeTab === 'custom' ? '#d97757' : '#665952',
                boxShadow: activeTab === 'custom' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span>✏️</span>
              <span>Tự đặt tên</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('couple')
                if (coupleCandidates[0]) {
                  handleSelectCoupleCandidate(coupleCandidates[0])
                }
              }}
              style={{
                border: 'none',
                padding: '8px 10px',
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: activeTab === 'couple' ? 700 : 500,
                background: activeTab === 'couple' ? '#fff' : 'transparent',
                color: activeTab === 'couple' ? '#d97757' : '#665952',
                boxShadow: activeTab === 'couple' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span>💑</span>
              <span>Theo Dâu Rể</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('random')
                handleGenerateRandom()
              }}
              style={{
                border: 'none',
                padding: '8px 10px',
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: activeTab === 'random' ? 700 : 500,
                background: activeTab === 'random' ? '#fff' : 'transparent',
                color: activeTab === 'random' ? '#d97757' : '#665952',
                boxShadow: activeTab === 'random' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span>🎲</span>
              <span>Ngẫu nhiên</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '18px 24px', flex: 1, overflowY: 'auto' }}>
          {/* Option 1: Tự đặt đường dẫn */}
          {activeTab === 'custom' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3c312b', marginBottom: 6 }}>
                Nhập đường dẫn bạn mong muốn:
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: `1.5px solid ${isDuplicate ? '#e67e22' : isAvailable ? '#4f7e65' : '#d4c8be'}`,
                  borderRadius: 10,
                  background: '#fff',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <span
                  style={{
                    padding: '10px 12px',
                    background: '#f8f5f1',
                    color: '#8c7d75',
                    fontSize: 13,
                    fontWeight: 500,
                    borderRight: '1px solid #ebdcd1',
                    userSelect: 'none',
                  }}
                >
                  thiepminh.io.vn/
                </span>
                <input
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    color: '#222',
                    fontFamily: 'monospace',
                  }}
                  placeholder="VD: chien-hang, dam-cuoi-minh-ngoc..."
                  value={slugInput}
                  onChange={handleInputChange}
                  autoFocus
                />
                {checking && (
                  <span style={{ padding: '0 12px', color: '#999', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconRefreshCw size={14} className="spin" />
                  </span>
                )}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#888' }}>
                Hỗ trợ chữ thường không dấu, số và dấu gạch ngang (VD: <code>chien-hang</code>).
              </p>
            </div>
          )}

          {/* Option 2: Gợi ý theo dâu rể */}
          {activeTab === 'couple' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#3c312b' }}>
                  Gợi ý chuẩn hoá theo tên cặp đôi:
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {coupleCandidates.map((cand) => {
                  const isSelected = activeCleanSlug === cand
                  return (
                    <button
                      key={cand}
                      type="button"
                      onClick={() => handleSelectCoupleCandidate(cand)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${isSelected ? '#d97757' : '#e6ddd5'}`,
                        background: isSelected ? '#fdf4f0' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconHeart size={14} color={isSelected ? '#d97757' : '#999'} />
                        <span style={{ fontFamily: 'monospace', fontSize: 13.5, color: isSelected ? '#d97757' : '#333', fontWeight: isSelected ? 700 : 500 }}>
                          thiepminh.io.vn/<strong>{cand}</strong>
                        </span>
                      </div>
                      {isSelected && <IconCheck size={16} color="#d97757" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Option 3: Tạo ngẫu nhiên */}
          {activeTab === 'random' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#3c312b' }}>
                  Mã ngẫu nhiên độc nhất (100% không trùng):
                </span>
                <button
                  type="button"
                  onClick={handleGenerateRandom}
                  style={{
                    border: 'none',
                    background: '#f4ede6',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#d97757',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconRefreshCw size={12} />
                  <span>Tạo mã khác</span>
                </button>
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  background: '#f8f5f1',
                  borderRadius: 10,
                  border: '1px solid #e6ddd5',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  color: '#2c221e',
                  fontWeight: 600,
                }}
              >
                thiepminh.io.vn/<strong>{activeCleanSlug}</strong>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#888' }}>
                Phương án này đảm bảo link ngắn, độc nhất và tuyệt đối không bao giờ phát sinh trùng lặp.
              </p>
            </div>
          )}

          {/* Notification: trùng lặp vs khả dụng */}
          <div style={{ marginTop: 14 }}>
            {isDuplicate && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#fff9f0',
                  border: '1px solid #fbd38d',
                  color: '#975a16',
                  fontSize: 12.5,
                  lineHeight: 1.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                  <IconAlertCircle size={15} color="#dd6b20" />
                  <span>Đường dẫn "{activeCleanSlug}" đã có người sử dụng!</span>
                </div>
                <div>
                  Hệ thống sẽ tự động thêm đuôi phân biệt: <strong>{suggestedSlug}</strong> để bạn sử dụng ngay.
                </div>
                {suggestedSlug && (
                  <button
                    type="button"
                    onClick={handleApplySuggested}
                    style={{
                      marginTop: 8,
                      padding: '5px 12px',
                      borderRadius: 6,
                      background: '#dd6b20',
                      color: '#fff',
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Dùng ngay: {suggestedSlug}
                  </button>
                )}
              </div>
            )}

            {isAvailable && activeCleanSlug && activeCleanSlug !== currentSlug && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <IconCheck size={15} color="#16a34a" />
                <span>
                  Đường dẫn <strong>{activeCleanSlug}</strong> hoàn toàn khả dụng và chưa ai dùng!
                </span>
              </div>
            )}

            {saveSuccess && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <IconCheck size={16} color="#16a34a" />
                <span>Đã cập nhật đường dẫn thiệp thành công!</span>
              </div>
            )}

            {saveError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 12.5,
                  marginTop: 10,
                }}
              >
                {saveError}
              </div>
            )}
          </div>

          {/* Preview Khung Link mới */}
          <div
            style={{
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: 12,
              background: '#fcfaf8',
              border: '1px dashed #d8cfc6',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#887c75', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Xem trước link thiệp của bạn:
            </div>
            <div style={{ fontSize: 13, color: '#2c221e', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              Link chung:{' '}
              <strong style={{ color: '#d97757' }}>
                https://thiepminh.io.vn/{activeCleanSlug || currentSlug}
              </strong>
            </div>
            <div style={{ fontSize: 12, color: '#665c56', marginTop: 4, wordBreak: 'break-all', fontFamily: 'monospace' }}>
              Link mời riêng:{' '}
              <span>https://thiepminh.io.vn/{activeCleanSlug || currentSlug}?g=bc98494e</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #f0eae4',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#faf7f5',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              border: '1px solid #d4c8be',
              background: '#fff',
              fontSize: 13,
              fontWeight: 600,
              color: '#554a44',
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || checking || !activeCleanSlug}
            style={{
              padding: '9px 22px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #e58d6f, #c96547)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || checking || !activeCleanSlug ? 'not-allowed' : 'pointer',
              opacity: saving || checking || !activeCleanSlug ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {saving ? (
              <>
                <IconRefreshCw size={13} className="spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <IconSparkles size={14} />
                <span>Lưu Đường Dẫn</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

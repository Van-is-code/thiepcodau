import React, { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../api'
import {
  IconX,
  IconCheck,
  IconAlertCircle,
  IconRefreshCw,
  IconSparkles,
  IconHeart,
  IconLock,
} from './Icons'

const removeDiacriticsVi = (str) => {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export const cleanSlug = (str) => {
  return removeDiacriticsVi(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export const validateSlugFormat = (raw) => {
  if (!raw || !raw.trim()) {
    return { valid: false, message: 'Vui lòng nhập đường dẫn bạn mong muốn.' }
  }
  const str = raw.trim()

  // 1. Ký tự có dấu tiếng Việt
  const viAccents = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
  if (viAccents.test(str)) {
    return {
      valid: false,
      message: 'Đường dẫn không được chứa ký tự có dấu tiếng Việt (ví dụ: "đ", "á", "ê"...). Vui lòng nhập chữ không dấu (VD: dangchien-minhhang).',
    }
  }

  // 2. Khoảng trắng
  if (/\s/.test(str)) {
    return {
      valid: false,
      message: 'Đường dẫn không được chứa khoảng trắng. Vui lòng dùng dấu gạch ngang (-) để phân tách.',
    }
  }

  // 3. Chữ in hoa
  if (/[A-Z]/.test(str)) {
    return {
      valid: false,
      message: 'Đường dẫn không được chứa chữ in hoa. Vui lòng chỉ dùng chữ thường (a-z).',
    }
  }

  // 4. Ký tự đặc biệt khác a-z, 0-9, -
  if (/[^a-z0-9-]/.test(str)) {
    return {
      valid: false,
      message: 'Đường dẫn chỉ được chứa chữ thường không dấu (a-z), chữ số (0-9) và dấu gạch ngang (-). Không dùng ký tự đặc biệt (@, _, ., /,...).',
    }
  }

  // 5. Độ dài
  if (str.length < 3) {
    return {
      valid: false,
      message: 'Đường dẫn phải có độ dài ít nhất 3 ký tự.',
    }
  }
  if (str.length > 60) {
    return {
      valid: false,
      message: 'Đường dẫn không được dài quá 60 ký tự.',
    }
  }

  // 6. Gạch ngang đầu hoặc cuối
  if (str.startsWith('-') || str.endsWith('-')) {
    return {
      valid: false,
      message: 'Đường dẫn không được bắt đầu hoặc kết thúc bằng dấu gạch ngang (-).',
    }
  }

  // 7. Gạch ngang liên tiếp --
  if (/--+/.test(str)) {
    return {
      valid: false,
      message: 'Đường dẫn không được chứa nhiều dấu gạch ngang liền nhau (--).',
    }
  }

  return { valid: true, message: null, slug: str }
}

const generateRandomSlug = () => `thiep-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function ChangeSlugModal({
  isOpen,
  onClose,
  invitation,
  mode = 'edit', // 'edit' | 'create'
  onSlugChanged,
  onConfirmCreate,
}) {
  const [activeTab, setActiveTab] = useState('custom') // 'custom' | 'couple' | 'random'
  const [slugInput, setSlugInput] = useState('')
  const [formatError, setFormatError] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  // State nhập tên dâu rể cho mode create
  const [inputGroom, setInputGroom] = useState('')
  const [inputBride, setInputBride] = useState('')

  const debounceRef = useRef(null)

  const isLocked = Boolean(invitation?.extra_data?.slug_customized && mode !== 'create')
  const currentSlug = invitation?.invitation_slug || invitation?.slug || ''

  // Tên dâu rể rút gọn
  const coupleCandidates = useMemo(() => {
    let groomName = ''
    let brideName = ''

    if (mode === 'create') {
      groomName = inputGroom
      brideName = inputBride
    } else {
      groomName = invitation?.groom?.name_groom || ''
      brideName = invitation?.bride?.name_bride || ''
    }

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
  }, [invitation, mode, inputGroom, inputBride])

  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        const initRnd = generateRandomSlug()
        setSlugInput('')
        setFormatError('')
        setCheckResult(null)
        setSaveSuccess(false)
        setSaveError('')
        setActiveTab('custom')
        setInputGroom('')
        setInputBride('')
      } else {
        setSlugInput(currentSlug)
        setFormatError('')
        setCheckResult({ available: true, slug: currentSlug, suggested: null })
        setSaveSuccess(false)
        setSaveError('')
        setActiveTab('custom')
      }
    }
  }, [isOpen, currentSlug, mode])

  // Kiểm tra tính khả dụng của slug với BE
  const checkAvailability = async (slugToCheck) => {
    const valResult = validateSlugFormat(slugToCheck)
    if (!valResult.valid) {
      setFormatError(valResult.message)
      setCheckResult(null)
      return
    }
    setFormatError('')

    const targetSlug = valResult.slug
    if (targetSlug === currentSlug && mode !== 'create') {
      setCheckResult({
        available: true,
        slug: targetSlug,
        suggested: null,
        message: 'Đường dẫn hiện tại của thiệp',
      })
      return
    }

    setChecking(true)
    try {
      const targetId = invitation?.id || 'new'
      const res = await api.checkInvitationSlug(targetId, targetSlug)
      const data = res.data?.data || res.data
      if (data.format_error) {
        setFormatError(data.message)
        setCheckResult(null)
      } else {
        setCheckResult(data)
      }
    } catch (_err) {
      setCheckResult({
        available: false,
        slug: targetSlug,
        suggested: `${targetSlug}-${new Date().getFullYear()}`,
        message: 'Lỗi khi kiểm tra. Bạn có thể sử dụng đuôi gợi ý.',
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

    // Kiểm tra định dạng trực tiếp
    const valResult = validateSlugFormat(raw)
    if (!valResult.valid) {
      setFormatError(valResult.message)
      setCheckResult(null)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      return
    }
    setFormatError('')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      checkAvailability(raw)
    }, 350)
  }

  // Tự động sửa lỗi định dạng
  const handleAutoClean = () => {
    const cleaned = cleanSlug(slugInput)
    if (cleaned) {
      setSlugInput(cleaned)
      setFormatError('')
      checkAvailability(cleaned)
    }
  }

  // Chọn 1 candidate từ Couple
  const handleSelectCoupleCandidate = (candidate) => {
    setSlugInput(candidate)
    setFormatError('')
    checkAvailability(candidate)
  }

  // Tạo random slug mới
  const handleGenerateRandom = () => {
    const rnd = generateRandomSlug()
    setSlugInput(rnd)
    setFormatError('')
    checkAvailability(rnd)
  }

  // Áp dụng đuôi gợi ý khi bị trùng
  const handleApplySuggested = () => {
    if (checkResult?.suggested) {
      setSlugInput(checkResult.suggested)
      setFormatError('')
      checkAvailability(checkResult.suggested)
    }
  }

  // Lưu hoặc xác nhận tạo
  const handleConfirm = async () => {
    const valResult = validateSlugFormat(slugInput)
    if (!valResult.valid) {
      setFormatError(valResult.message)
      return
    }

    const finalSlug = valResult.slug

    // Nếu mode="create": trả slug về cho luồng tạo thiệp
    if (mode === 'create') {
      if (onConfirmCreate) {
        onConfirmCreate(finalSlug)
      }
      onClose()
      return
    }

    // Nếu mode="edit": gọi API cập nhật và khoá 1 lần duy nhất
    if (!invitation?.id) return

    setSaving(true)
    setSaveError('')
    try {
      const res = await api.setInvitationSlug(invitation.id, finalSlug)
      const data = res.data?.data || res.data
      const appliedSlug = data?.invitation_slug || finalSlug
      setSaveSuccess(true)
      if (onSlugChanged) {
        onSlugChanged(appliedSlug)
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

  const isDuplicate = checkResult && checkResult.available === false && !formatError
  const isAvailable = checkResult && checkResult.available === true && !formatError
  const suggestedSlug = checkResult?.suggested
  const isValidFormat = !formatError && slugInput.trim().length >= 3

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 25, 23, 0.65)',
        backdropFilter: 'blur(6px)',
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
              <span style={{ fontSize: 18 }}>{isLocked ? '🔒' : '🔗'}</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#2c221e' }}>
                {mode === 'create'
                  ? 'Thiết Lập Đường Dẫn Thiệp (Slug)'
                  : isLocked
                  ? 'Đường Dẫn Thiệp Đã Cố Định'
                  : 'Tuỳ Chỉnh Đường Dẫn Thiệp (Slug)'}
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#776c66', lineHeight: 1.4 }}>
              {mode === 'create'
                ? 'Bắt buộc thiết lập ngay từ đầu. Chỉ được đặt 1 lần duy nhất để cố định cho mã QR và link chia sẻ.'
                : isLocked
                ? 'Đường dẫn thiệp đã được xác nhận và cố định để bảo vệ an toàn cho các liên kết và mã QR.'
                : 'Lưu ý quan trọng: Chỉ được thiết lập 1 lần duy nhất và sẽ khoá cố định sau khi lưu.'}
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

        {/* Lock Banner if locked */}
        {isLocked && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px 16px',
              borderRadius: 12,
              background: '#fff9e6',
              border: '1px solid #ffe58f',
              color: '#874d00',
              fontSize: 13,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              lineHeight: 1.5,
            }}
          >
            <IconLock size={18} color="#d48806" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Đường dẫn đã được cố định vĩnh viễn (1 lần duy nhất):</strong>
              <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#d48806' }}>
                https://thiepminh.io.vn/{currentSlug}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#ad6800' }}>
                Nhằm bảo vệ an toàn cho các mã QR in trên phong bì và các liên kết đã gửi cho khách mời, hệ thống không cho phép sửa đổi lại đường dẫn này.
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection (only if not locked) */}
        {!isLocked && (
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
        )}

        {/* Tab Body */}
        <div style={{ padding: '18px 24px', flex: 1, overflowY: 'auto' }}>
          {!isLocked && (
            <>
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
                      border: `1.5px solid ${
                        formatError ? '#c04938' : isDuplicate ? '#e67e22' : isAvailable ? '#4f7e65' : '#d4c8be'
                      }`,
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
                      placeholder="VD: dangchien-minhhang..."
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

                  {/* Format Error Warning */}
                  {formatError && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: '#fef2f2',
                        border: '1px solid #fca5a5',
                        color: '#b91c1c',
                        fontSize: 12.5,
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <IconAlertCircle size={15} color="#dc2626" />
                        <span>Sai định dạng đường dẫn:</span>
                      </div>
                      <div style={{ marginTop: 3 }}>{formatError}</div>
                      {cleanSlug(slugInput) && cleanSlug(slugInput) !== slugInput && (
                        <button
                          type="button"
                          onClick={handleAutoClean}
                          style={{
                            marginTop: 8,
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ⚡ Sửa nhanh thành: {cleanSlug(slugInput)}
                        </button>
                      )}
                    </div>
                  )}

                  {!formatError && (
                    <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#888' }}>
                      Quy chuẩn: Chỉ dùng chữ thường không dấu (a-z), chữ số (0-9) và dấu gạch ngang (VD: <code>dangchien-minhhang</code>).
                    </p>
                  )}
                </div>
              )}

              {/* Option 2: Gợi ý theo dâu rể */}
              {activeTab === 'couple' && (
                <div>
                  {mode === 'create' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                          Tên chú rể:
                        </label>
                        <input
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d4c8be',
                            borderRadius: 8,
                            fontSize: 13,
                          }}
                          placeholder="VD: Đăng Chiến"
                          value={inputGroom}
                          onChange={(e) => setInputGroom(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                          Tên cô dâu:
                        </label>
                        <input
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d4c8be',
                            borderRadius: 8,
                            fontSize: 13,
                          }}
                          placeholder="VD: Minh Hằng"
                          value={inputBride}
                          onChange={(e) => setInputBride(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#3c312b' }}>
                      Gợi ý chuẩn hoá theo tên cặp đôi:
                    </span>
                  </div>

                  {coupleCandidates.length === 0 ? (
                    <div style={{ padding: '16px', background: '#fdfaf7', borderRadius: 10, textAlign: 'center', fontSize: 12.5, color: '#888' }}>
                      Nhập tên cô dâu và chú rể ở trên để tự động tạo gợi ý đường dẫn đẹp mắt.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {coupleCandidates.map((cand) => {
                        const isSelected = slugInput === cand
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
                  )}
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
                    thiepminh.io.vn/<strong>{slugInput}</strong>
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
                      <span>Đường dẫn "{slugInput}" đã có người sử dụng!</span>
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

                {isAvailable && slugInput && slugInput !== currentSlug && (
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
                      Đường dẫn <strong>{slugInput}</strong> hoàn toàn khả dụng và chưa ai dùng!
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
                    <span>Đã xác nhận và cố định đường dẫn thiệp thành công!</span>
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
                    https://thiepminh.io.vn/{slugInput || currentSlug || '...'}
                  </strong>
                </div>
                <div style={{ fontSize: 12, color: '#665c56', marginTop: 4, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  Link mời riêng:{' '}
                  <span>https://thiepminh.io.vn/{slugInput || currentSlug || '...'}?g=bc98494e</span>
                </div>
              </div>
            </>
          )}

          {isLocked && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: '#fcfaf8',
                border: '1px dashed #d8cfc6',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#887c75', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Liên kết đang hoạt động:
              </div>
              <div style={{ fontSize: 13, color: '#2c221e', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                Link chung:{' '}
                <strong style={{ color: '#d97757' }}>
                  https://thiepminh.io.vn/{currentSlug}
                </strong>
              </div>
              <div style={{ fontSize: 12, color: '#665c56', marginTop: 4, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                Link mời riêng:{' '}
                <span>https://thiepminh.io.vn/{currentSlug}?g=bc98494e</span>
              </div>
            </div>
          )}
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
            {isLocked ? 'Đóng' : 'Huỷ Bỏ'}
          </button>

          {!isLocked && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || checking || !isValidFormat || isDuplicate}
              style={{
                padding: '9px 22px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #e58d6f, #c96547)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: saving || checking || !isValidFormat || isDuplicate ? 'not-allowed' : 'pointer',
                opacity: saving || checking || !isValidFormat || isDuplicate ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {saving ? (
                <>
                  <IconRefreshCw size={13} className="spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : mode === 'create' ? (
                <>
                  <IconSparkles size={14} />
                  <span>Tạo Thiệp Ngay</span>
                </>
              ) : (
                <>
                  <IconLock size={14} />
                  <span>Cố Định Đường Dẫn (1 Lần)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

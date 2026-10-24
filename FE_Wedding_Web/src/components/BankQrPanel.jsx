import React, { useRef, useState } from 'react'
import { api } from '../api'
import {
  IconQrCode,
  IconUploadCloud,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconCheckCircle,
  IconUser,
  IconUsers,
  IconTrash2,
  IconRefreshCw,
} from './Icons'

export default function BankQrPanel({ invitation, onSaved, onClose }) {
  const curBank = invitation?.extra_data?.bank || {}
  const groomRef = useRef(null)
  const brideRef = useRef(null)

  // 1. Chế độ hiển thị mừng cưới trên thiệp: 'both' | 'groom' | 'bride'
  const [displayMode, setDisplayMode] = useState(curBank.display_mode || 'both')

  // 2. Tab cấu hình đang mở: 'groom' | 'bride'
  const [activeTab, setActiveTab] = useState(displayMode === 'bride' ? 'bride' : 'groom')

  // Dữ liệu tài khoản chú rể
  const [groomData, setGroomData] = useState({
    bank_name: curBank.groom?.bank_name || invitation?.groom?.bank_name || '',
    bank_short_name: curBank.groom?.bank_short_name || '',
    bank_account_number: curBank.groom?.bank_account_number || invitation?.groom?.bank_account_number || '',
    bank_account_name: curBank.groom?.bank_account_name || invitation?.groom?.bank_account_name || '',
    qr_image: curBank.groom?.qr_image || '',
    qr_content: curBank.groom?.qr_content || '',
  })

  // Dữ liệu tài khoản cô dâu
  const [brideData, setBrideData] = useState({
    bank_name: curBank.bride?.bank_name || invitation?.bride?.bank_name || '',
    bank_short_name: curBank.bride?.bank_short_name || '',
    bank_account_number: curBank.bride?.bank_account_number || invitation?.bride?.bank_account_number || '',
    bank_account_name: curBank.bride?.bank_account_name || invitation?.bride?.bank_account_name || '',
    qr_image: curBank.bride?.qr_image || '',
    qr_content: curBank.bride?.qr_content || '',
  })

  const [scanStatus, setScanStatus] = useState('idle') // idle | scanning | error
  const [scanTarget, setScanTarget] = useState(null) // 'groom' | 'bride'
  const [err, setErr] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error

  const groomName = invitation?.groom?.name_groom || invitation?.groom_name || 'Chú rể'
  const brideName = invitation?.bride?.name_bride || invitation?.bride_name || 'Cô dâu'

  const handleScan = async (file, role) => {
    if (!file) return
    setScanStatus('scanning')
    setScanTarget(role)
    setErr('')

    try {
      const fd = new FormData()
      fd.append('qr', file)
      const res = await api.scanBankQr(fd)
      const data = res.data?.data || res.data

      const newInfo = {
        bank_name: data.bankShortName || data.bankName || (data.bankBin ? `BIN ${data.bankBin}` : ''),
        bank_short_name: data.bankShortName || '',
        bank_account_number: data.accountNumber || '',
        bank_account_name: (data.accountName || '').toUpperCase(),
        qr_content: data.qrContent || '',
        qr_image: data.qrImage || '',
      }

      if (role === 'groom') {
        setGroomData((prev) => ({
          ...prev,
          ...newInfo,
          bank_account_name: newInfo.bank_account_name || prev.bank_account_name || groomName.toUpperCase(),
        }))
      } else {
        setBrideData((prev) => ({
          ...prev,
          ...newInfo,
          bank_account_name: newInfo.bank_account_name || prev.bank_account_name || brideName.toUpperCase(),
        }))
      }
      setScanStatus('idle')
      setScanTarget(null)
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Không quét được mã QR')
      setScanStatus('error')
      setScanTarget(null)
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    setErr('')

    const payload = {
      display_mode: displayMode,
      groom: {
        bank_name: (groomData.bank_name || '').trim(),
        bank_short_name: (groomData.bank_short_name || '').trim(),
        bank_account_number: (groomData.bank_account_number || '').trim(),
        bank_account_name: (groomData.bank_account_name || '').trim().toUpperCase(),
        qr_content: groomData.qr_content || '',
        qr_image: groomData.qr_image || '',
      },
      bride: {
        bank_name: (brideData.bank_name || '').trim(),
        bank_short_name: (brideData.bank_short_name || '').trim(),
        bank_account_number: (brideData.bank_account_number || '').trim(),
        bank_account_name: (brideData.bank_account_name || '').trim().toUpperCase(),
        qr_content: brideData.qr_content || '',
        qr_image: brideData.qr_image || '',
      },
      // Thông tin hiển thị chính cho các mẫu cơ bản
      bank_name: (displayMode === 'bride' ? brideData.bank_name : groomData.bank_name) || groomData.bank_name || brideData.bank_name || '',
      bank_short_name: (displayMode === 'bride' ? brideData.bank_short_name : groomData.bank_short_name) || groomData.bank_short_name || brideData.bank_short_name || '',
      bank_account_number: (displayMode === 'bride' ? brideData.bank_account_number : groomData.bank_account_number) || groomData.bank_account_number || brideData.bank_account_number || '',
      bank_account_name: (displayMode === 'bride' ? brideData.bank_account_name : groomData.bank_account_name) || groomData.bank_account_name || brideData.bank_account_name || '',
      qr_content: (displayMode === 'bride' ? brideData.qr_content : groomData.qr_content) || '',
    }

    try {
      await api.setInvitationBank(invitation.id, payload)
      setSaveStatus('saved')
      onSaved && onSaved({
        bank: payload,
        groomQr: groomData.qr_image,
        brideQr: brideData.qr_image,
      })
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Lưu thất bại')
      setSaveStatus('error')
    }
  }

  const curData = activeTab === 'groom' ? groomData : brideData
  const setCurData = (updater) => {
    if (activeTab === 'groom') {
      setGroomData(updater)
    } else {
      setBrideData(updater)
    }
  }

  const hasGroom = Boolean(groomData.bank_account_number || groomData.qr_image)
  const hasBride = Boolean(brideData.bank_account_number || brideData.qr_image)

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.box}>
        {/* Header */}
        <div style={S.head}>
          <div>
            <div style={S.title}>
              <IconQrCode size={19} color="#d97757" />
              <span>Cài đặt QR & Mừng cưới</span>
            </div>
            <div style={S.sub}>
              Tải ảnh QR để hệ thống tự động bóc số tài khoản &amp; tên ngân hàng. Có thể lưu sẵn cả 2 bên và chọn chế độ hiển thị trên thiệp.
            </div>
          </div>
          <button style={S.close} onClick={onClose} aria-label="Đóng"><IconX size={18} /></button>
        </div>

        <div style={S.body}>
          {/* 1. LỰA CHỌN CHẾ ĐỘ HIỂN THỊ */}
          <div style={S.sectionBlock}>
            <div style={S.sectionLabel}>CHẾ ĐỘ HIỂN THỊ MỪNG CƯỚI TRÊN THIỆP</div>
            <div style={S.modeGroup}>
              {/* Option 1: Bật cả 2 */}
              <button
                type="button"
                style={{
                  ...S.modeBtn,
                  ...(displayMode === 'both' ? S.modeBtnActive : {}),
                }}
                onClick={() => setDisplayMode('both')}
              >
                <div style={S.modeRadio}>
                  <div style={{ ...S.modeRadioDot, opacity: displayMode === 'both' ? 1 : 0 }} />
                </div>
                <div style={S.modeContent}>
                  <div style={S.modeTitle}>
                    <IconUsers size={15} color={displayMode === 'both' ? '#c96547' : '#6e625c'} />
                    <b>Hiển thị cả hai người</b>
                  </div>
                  <div style={S.modeDesc}>Có nút chuyển chọn Cô dâu / Chú rể để khách lựa chọn người nhận</div>
                </div>
              </button>

              {/* Option 2: Chỉ chú rể */}
              <button
                type="button"
                style={{
                  ...S.modeBtn,
                  ...(displayMode === 'groom' ? S.modeBtnActive : {}),
                }}
                onClick={() => {
                  setDisplayMode('groom')
                  setActiveTab('groom')
                }}
              >
                <div style={S.modeRadio}>
                  <div style={{ ...S.modeRadioDot, opacity: displayMode === 'groom' ? 1 : 0 }} />
                </div>
                <div style={S.modeContent}>
                  <div style={S.modeTitle}>
                    <IconUser size={15} color={displayMode === 'groom' ? '#c96547' : '#6e625c'} />
                    <b>Chỉ hiển thị Chú rể</b>
                    <span style={S.modeTagMuted}>Tắt Cô dâu</span>
                  </div>
                  <div style={S.modeDesc}>Ẩn nút chuyển chọn, hiển thị trực tiếp duy nhất STK &amp; QR Chú rể</div>
                </div>
              </button>

              {/* Option 3: Chỉ cô dâu */}
              <button
                type="button"
                style={{
                  ...S.modeBtn,
                  ...(displayMode === 'bride' ? S.modeBtnActive : {}),
                }}
                onClick={() => {
                  setDisplayMode('bride')
                  setActiveTab('bride')
                }}
              >
                <div style={S.modeRadio}>
                  <div style={{ ...S.modeRadioDot, opacity: displayMode === 'bride' ? 1 : 0 }} />
                </div>
                <div style={S.modeContent}>
                  <div style={S.modeTitle}>
                    <IconUser size={15} color={displayMode === 'bride' ? '#c96547' : '#6e625c'} />
                    <b>Chỉ hiển thị Cô dâu</b>
                    <span style={S.modeTagMuted}>Tắt Chú rể</span>
                  </div>
                  <div style={S.modeDesc}>Ẩn nút chuyển chọn, hiển thị trực tiếp duy nhất STK &amp; QR Cô dâu</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. TAB THIẾT LẬP THÔNG TIN CÔ DÂU / CHÚ RỂ */}
          <div style={S.sectionBlock}>
            <div style={S.sectionLabel}>THIẾT LẬP THÔNG TIN &amp; TẢI ẢNH QR</div>
            
            <div style={S.tabSwitchRow}>
              {/* Tab Chú rể */}
              <button
                type="button"
                style={{
                  ...S.tabSwitchBtn,
                  ...(activeTab === 'groom' ? S.tabSwitchBtnActive : {}),
                }}
                onClick={() => setActiveTab('groom')}
              >
                <span style={S.tabSwitchTitle}>🤵 Chú rể ({groomName})</span>
                <span style={{
                  ...S.tabBadge,
                  ...(hasGroom ? S.tabBadgeOk : S.tabBadgeEmpty),
                }}>
                  {hasGroom ? '✓ Đã có QR' : 'Chưa có'}
                </span>
                {displayMode === 'groom' && <span style={S.tabBadgeActiveMode}>Đang bật</span>}
                {displayMode === 'bride' && <span style={S.tabBadgeInactiveMode}>Đang tắt</span>}
              </button>

              {/* Tab Cô dâu */}
              <button
                type="button"
                style={{
                  ...S.tabSwitchBtn,
                  ...(activeTab === 'bride' ? S.tabSwitchBtnActive : {}),
                }}
                onClick={() => setActiveTab('bride')}
              >
                <span style={S.tabSwitchTitle}>👰 Cô dâu ({brideName})</span>
                <span style={{
                  ...S.tabBadge,
                  ...(hasBride ? S.tabBadgeOk : S.tabBadgeEmpty),
                }}>
                  {hasBride ? '✓ Đã có QR' : 'Chưa có'}
                </span>
                {displayMode === 'bride' && <span style={S.tabBadgeActiveMode}>Đang bật</span>}
                {displayMode === 'groom' && <span style={S.tabBadgeInactiveMode}>Đang tắt</span>}
              </button>
            </div>

            {/* Chi tiết người đang chọn */}
            <div style={S.tabContentBox}>
              <div style={S.uploadRow}>
                <button
                  type="button"
                  style={S.btnUpload}
                  onClick={() => (activeTab === 'groom' ? groomRef.current?.click() : brideRef.current?.click())}
                  disabled={scanStatus === 'scanning'}
                >
                  <IconUploadCloud size={16} />
                  <span>
                    {scanStatus === 'scanning' && scanTarget === activeTab
                      ? 'Đang quét ảnh QR…'
                      : curData.qr_image
                      ? 'Đổi ảnh mã QR khác'
                      : 'Tải ảnh mã QR ngân hàng'}
                  </span>
                </button>
                <span style={S.uploadTip}>Hệ thống tự động đọc STK, tên ngân hàng &amp; tạo mã VietQR</span>
              </div>

              <input
                ref={groomRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleScan(e.target.files?.[0], 'groom')}
              />
              <input
                ref={brideRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleScan(e.target.files?.[0], 'bride')}
              />

              {err && (
                <div style={S.err}>
                  <IconAlertCircle size={15} />
                  <span>{err}</span>
                </div>
              )}

              {/* Form nhập/sửa STK */}
              <div style={S.fieldsGrid}>
                <div style={S.field}>
                  <label style={S.flabel}>Tên ngân hàng</label>
                  <input
                    style={S.input}
                    value={curData.bank_name || ''}
                    onChange={(e) => setCurData((prev) => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="VD: Vietcombank, Techcombank, MB..."
                  />
                </div>

                <div style={S.field}>
                  <label style={S.flabel}>Số tài khoản</label>
                  <input
                    style={{ ...S.input, fontFamily: 'monospace', fontWeight: 600, color: '#c96547' }}
                    value={curData.bank_account_number || ''}
                    onChange={(e) => setCurData((prev) => ({ ...prev, bank_account_number: e.target.value }))}
                    placeholder="Nhập số tài khoản ngân hàng…"
                  />
                </div>

                <div style={S.field}>
                  <label style={S.flabel}>Tên chủ tài khoản</label>
                  <input
                    style={S.input}
                    value={curData.bank_account_name || ''}
                    onChange={(e) => setCurData((prev) => ({ ...prev, bank_account_name: e.target.value.toUpperCase() }))}
                    placeholder="VD: NGUYEN VAN A…"
                  />
                </div>
              </div>

              {/* Khung xem trước mã QR */}
              {curData.qr_image ? (
                <div style={S.qrPreviewCard}>
                  <img src={curData.qr_image} alt="Mã QR" style={S.qrImg} />
                  <div style={S.qrPreviewMeta}>
                    <div style={S.qrBadgeOk}>
                      <IconCheckCircle size={14} color="#2b7a4b" />
                      <span>Mã QR đã sẵn sàng</span>
                    </div>
                    <div style={S.qrAccHint}>
                      <b>{curData.bank_name || 'Ngân hàng'}</b>: {curData.bank_account_number || '---'}
                    </div>
                    <button
                      type="button"
                      style={S.btnRemoveQr}
                      onClick={() => setCurData((prev) => ({ ...prev, qr_image: '', qr_content: '' }))}
                    >
                      <IconTrash2 size={13} />
                      <span>Xoá mã QR này</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={S.qrEmptyBox}>
                  <IconQrCode size={32} color="#b3a59d" />
                  <span style={S.qrEmptyText}>Chưa tải ảnh QR. Bấm nút phía trên để tải ảnh QR hoặc nhập tay thông tin STK.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={S.actions}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: saveStatus === 'saved' ? '#2b7a4b' : '#6e625c' }}>
            {saveStatus === 'saved' ? '✓ Đã cập nhật cài đặt mừng cưới' : saveStatus === 'saving' ? 'Đang lưu…' : ''}
          </span>
          <button style={S.btnSave} onClick={handleSave} disabled={saveStatus === 'saving'}>
            <IconCheck size={16} />
            <span>{saveStatus === 'saving' ? 'Đang lưu...' : 'Lưu Cài Đặt (không tốn lượt sửa)'}</span>
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
    background: 'rgba(25, 20, 18, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 9999,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  box: {
    width: 'min(520px, 100%)',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '18px 22px 14px',
    borderBottom: '1px solid #f0ebe4',
    background: '#fcfaf8',
  },
  title: {
    fontSize: 16.5,
    fontWeight: 700,
    color: '#1f1917',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sub: {
    fontSize: 12,
    color: '#6e625c',
    marginTop: 4,
    lineHeight: 1.5,
  },
  close: {
    background: '#f4ede6',
    border: 'none',
    borderRadius: 9,
    padding: 7,
    cursor: 'pointer',
    color: '#6e625c',
    display: 'flex',
    flexShrink: 0,
  },
  body: {
    padding: '18px 22px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  sectionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#8c7e75',
    textTransform: 'uppercase',
  },
  modeGroup: {
    display: 'grid',
    gap: 8,
  },
  modeBtn: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1.5px solid #ede5db',
    background: '#fcfaf8',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
  },
  modeBtnActive: {
    border: '1.5px solid #c96547',
    background: '#fdf6ee',
  },
  modeRadio: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid #c96547',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  modeRadioDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#c96547',
    transition: 'opacity 0.15s ease',
  },
  modeContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  modeTitle: {
    fontSize: 13.5,
    fontWeight: 600,
    color: '#1f1917',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  modeTagMuted: {
    fontSize: 10.5,
    padding: '1px 6px',
    borderRadius: 4,
    background: '#eee8e2',
    color: '#7a6e67',
    fontWeight: 500,
  },
  modeDesc: {
    fontSize: 11.5,
    color: '#70645c',
    lineHeight: 1.4,
  },
  tabSwitchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  tabSwitchBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1.5px solid #ede5db',
    background: '#fcfaf8',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabSwitchBtnActive: {
    border: '1.5px solid #342644',
    background: '#ffffff',
    boxShadow: '0 3px 10px rgba(52,38,68,0.08)',
  },
  tabSwitchTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1f1917',
  },
  tabBadge: {
    fontSize: 10.5,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
  },
  tabBadgeOk: {
    background: '#e6f4ea',
    color: '#2b7a4b',
  },
  tabBadgeEmpty: {
    background: '#f0ebe4',
    color: '#8c7e75',
  },
  tabBadgeActiveMode: {
    fontSize: 10,
    fontWeight: 600,
    color: '#c96547',
    background: '#fdf0e6',
    padding: '1px 6px',
    borderRadius: 6,
  },
  tabBadgeInactiveMode: {
    fontSize: 10,
    fontWeight: 500,
    color: '#998d85',
  },
  tabContentBox: {
    background: '#faf8f5',
    border: '1px solid #eee6dc',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 4,
  },
  uploadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  btnUpload: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 16px',
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 9,
    border: '1px solid #d9cebe',
    background: '#ffffff',
    color: '#1f1917',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  uploadTip: {
    fontSize: 11,
    color: '#8c7e75',
    flex: 1,
    minWidth: 150,
  },
  err: {
    fontSize: 12,
    color: '#c04938',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fdf2f0',
    padding: '6px 10px',
    borderRadius: 8,
  },
  fieldsGrid: {
    display: 'grid',
    gap: 10,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  flabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#5c524c',
  },
  input: {
    height: 38,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #d9cebe',
    fontSize: 13,
    background: '#ffffff',
    color: '#1f1917',
    outline: 'none',
  },
  qrPreviewCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: '#ffffff',
    border: '1px solid #ede5db',
    borderRadius: 12,
    padding: 12,
  },
  qrImg: {
    width: 110,
    height: 110,
    borderRadius: 8,
    border: '1px solid #eee',
    objectFit: 'contain',
    background: '#fff',
  },
  qrPreviewMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  qrBadgeOk: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11.5,
    fontWeight: 600,
    color: '#2b7a4b',
  },
  qrAccHint: {
    fontSize: 12,
    color: '#3d342f',
  },
  btnRemoveQr: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    padding: '5px 10px',
    fontSize: 11.5,
    fontWeight: 500,
    borderRadius: 6,
    border: '1px solid #f0d5ce',
    background: '#fff5f3',
    color: '#c04938',
    cursor: 'pointer',
    marginTop: 4,
  },
  qrEmptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '16px 12px',
    border: '1px dashed #d9cebe',
    borderRadius: 10,
    background: '#fcfaf8',
  },
  qrEmptyText: {
    fontSize: 11.5,
    color: '#8c7e75',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 22px 18px',
    borderTop: '1px solid #f0ebe4',
    background: '#fcfaf8',
  },
  btnSave: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(201,101,71,0.25)',
  },
}

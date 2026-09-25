import React, { useRef, useState } from 'react'
import { api } from '../api'
import { IconQrCode, IconUploadCloud, IconX, IconCheck, IconAlertCircle, IconCheckCircle } from './Icons'

// 1 mã QR ngân hàng mừng cưới cho CẢ thiệp (không tách cô dâu / chú rể).
// Quét ảnh QR -> bóc STK/tên/ngân hàng -> lưu vào extra_data.bank + trả qrImage
// cho trình sửa lưu thành ảnh trong mục Quà cưới (image_type: bank_qr).
export default function BankQrPanel({ invitation, onSaved, onClose }) {
  const inputRef = useRef(null)
  const cur = invitation?.extra_data?.bank || {}
  const [status, setStatus] = useState('idle') // idle|scanning|scanned|saving|saved|error
  const [err, setErr] = useState('')
  const [scan, setScan] = useState(null)
  const [accountName, setAccountName] = useState(cur.bank_account_name || '')

  const handleFile = async (file) => {
    if (!file) return
    setStatus('scanning'); setErr(''); setScan(null)
    try {
      const fd = new FormData()
      fd.append('qr', file)
      const res = await api.scanBankQr(fd)
      const data = res.data?.data || res.data
      setScan(data)
      setAccountName(data.accountName || cur.bank_account_name || '')
      setStatus('scanned')
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Không quét được mã QR')
      setStatus('error')
    }
  }

  const save = async () => {
    if (!scan) return
    setStatus('saving'); setErr('')
    const bank = {
      bank_name: scan.bankShortName || scan.bankName || '',
      bank_short_name: scan.bankShortName || '',
      bank_account_number: scan.accountNumber || '',
      bank_account_name: (accountName || '').trim(),
      qr_content: scan.qrContent || '',
    }
    try {
      await api.setInvitationBank(invitation.id, bank)
      setStatus('saved')
      onSaved && onSaved({ bank, qrImage: scan.qrImage })
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Lưu thất bại')
      setStatus('error')
    }
  }

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.box}>
        <div style={S.head}>
          <div>
            <div style={S.title}><IconQrCode size={18} color="#d97757" /> Mã QR ngân hàng mừng cưới</div>
            <div style={S.sub}>Mỗi thiệp dùng chung 1 mã QR. Tải ảnh QR — hệ thống tự bóc STK, tên, ngân hàng & sinh QR chuẩn, gắn vào mục Quà cưới.</div>
          </div>
          <button style={S.close} onClick={onClose}><IconX size={18} /></button>
        </div>

        <div style={S.body}>
          {cur.bank_account_number && status === 'idle' && (
            <div style={S.current}>
              <b>Đang dùng:</b> {cur.bank_name} — {cur.bank_account_number}
              {cur.bank_account_name ? ` (${cur.bank_account_name})` : ''}
            </div>
          )}

          <button style={S.btnUpload} onClick={() => inputRef.current?.click()} disabled={status === 'scanning'}>
            <IconUploadCloud size={16} />
            {status === 'scanning' ? 'Đang quét QR…' : 'Tải ảnh mã QR ngân hàng'}
          </button>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />

          {err && <div style={S.err}><IconAlertCircle size={14} /> {err}</div>}

          {scan && (
            <div style={S.result}>
              <div style={S.field}><span style={S.flabel}>Ngân hàng</span><span style={S.fval}>{scan.bankShortName || scan.bankName || `BIN ${scan.bankBin}`}</span></div>
              <div style={S.field}><span style={S.flabel}>Số tài khoản</span><span style={S.fvalCode}>{scan.accountNumber}</span></div>
              <div style={S.field}>
                <span style={S.flabel}>Tên chủ tài khoản</span>
                <input style={S.nameInput} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Nhập tên chủ tài khoản…" />
              </div>
              {scan.qrImage && (
                <div style={S.qrBox}>
                  <img src={scan.qrImage} alt="QR chuẩn hoá" style={S.qrImg} />
                  <span style={S.qrCap}><IconCheckCircle size={12} color="#4f7e65" /> QR do hệ thống sinh lại</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={S.actions}>
          <span style={{ fontSize: 12, color: status === 'saved' ? '#4f7e65' : '#6e625c' }}>
            {status === 'saved' ? '✓ Đã lưu vào thiệp' : status === 'saving' ? 'Đang lưu…' : ''}
          </span>
          <button style={S.btnMain} onClick={save} disabled={!scan || status === 'saving' || !accountName.trim()}>
            <IconCheck size={15} /> Lưu QR (không tính lượt sửa)
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(31,25,23,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9400, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  box: { width: 'min(460px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '18px 20px 12px', borderBottom: '1px solid #ede5db' },
  title: { fontSize: 15.5, fontWeight: 700, color: '#1f1917', display: 'flex', alignItems: 'center', gap: 7 },
  sub: { fontSize: 11.5, color: '#6e625c', marginTop: 4, lineHeight: 1.5 },
  close: { background: '#f6f1eb', border: '1px solid #ede5db', borderRadius: 9, padding: 7, cursor: 'pointer', color: '#6e625c', display: 'flex', flexShrink: 0 },
  body: { padding: '16px 20px', overflowY: 'auto', flex: 1 },
  current: { fontSize: 12.5, color: '#5c524c', background: '#f6f1eb', borderRadius: 10, padding: '10px 12px', marginBottom: 12, border: '1px solid #ede5db' },
  btnUpload: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1px solid #ede5db', background: '#f6f1eb', color: '#1f1917', cursor: 'pointer' },
  err: { marginTop: 12, fontSize: 12.5, color: '#c04938', display: 'flex', alignItems: 'center', gap: 6 },
  result: { marginTop: 16, borderTop: '1px dashed #ede5db', paddingTop: 14, display: 'grid', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  flabel: { fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9e918a', fontWeight: 700 },
  fval: { fontSize: 14, color: '#1f1917', fontWeight: 600 },
  fvalCode: { fontSize: 15, color: '#d97757', fontFamily: "'Courier New', monospace", fontWeight: 700 },
  nameInput: { height: 38, padding: '0 12px', border: '1px solid #ede5db', borderRadius: 10, fontSize: 13.5, background: '#fcfaf7' },
  qrBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 14, background: '#fcfaf7', borderRadius: 12, border: '1px solid #ede5db' },
  qrImg: { width: 150, height: 150, borderRadius: 10, border: '1px solid #ede5db' },
  qrCap: { fontSize: 11, color: '#4f7e65', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 },
  actions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '12px 20px 16px', borderTop: '1px solid #ede5db' },
  btnMain: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)', color: '#fff', cursor: 'pointer' },
}

import React, { useRef, useState } from 'react'
import { api } from '../api'
import { IconQrCode, IconUploadCloud, IconCheck, IconAlertCircle, IconCheckCircle, IconCreditCard } from './Icons'

// Quét QR ngân hàng: Tự động bóc STK, BIN, tên chủ TK & sinh mã QR sạch
export default function BankQrUpload({ role = 'groom', targetId, initial = {}, onSaved }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | scanning | scanned | saving | saved | error
  const [error, setError] = useState('')
  const [scan, setScan] = useState(null)
  const [accountName, setAccountName] = useState(initial.bank_account_name || '')

  const label = role === 'bride' ? 'Cô dâu' : 'Chú rể'

  const handleFile = async (file) => {
    if (!file) return
    setStatus('scanning')
    setError('')
    setScan(null)
    try {
      const fd = new FormData()
      fd.append('qr', file)
      const res = await api.scanBankQr(fd)
      const data = res.data?.data || res.data
      setScan(data)
      setAccountName(data.accountName || initial.bank_account_name || '')
      setStatus('scanned')
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Không quét được mã QR')
      setStatus('error')
    }
  }

  const handleSave = async () => {
    if (!scan || !targetId) return
    setStatus('saving')
    setError('')
    const payload = {
      bank_name: scan.bankShortName || scan.bankName || '',
      bank_account_number: scan.accountNumber || '',
      bank_account_name: (accountName || '').trim(),
    }
    try {
      if (role === 'bride') await api.updateBride(targetId, payload)
      else await api.updateGroom(targetId, payload)
      setStatus('saved')
      onSaved && onSaved({ ...payload, qrImage: scan.qrImage, role })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Lưu thất bại')
      setStatus('error')
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <div style={S.iconBox}>
          <IconQrCode size={20} color="#d97757" />
        </div>
        <div style={S.headText}>
          <div style={S.title}>Tài khoản ngân hàng mừng cưới ({label})</div>
          <div style={S.sub}>Tải ảnh QR — hệ thống tự động bóc STK, tên, ngân hàng & sinh mã QR chuẩn.</div>
        </div>
        <button
          type="button"
          style={S.btnUpload}
          onClick={() => inputRef.current?.click()}
          disabled={status === 'scanning'}
        >
          <IconUploadCloud size={16} />
          {status === 'scanning' ? 'Đang quét QR…' : 'Tải ảnh QR'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {initial.bank_account_number && status === 'idle' && (
        <div style={S.current}>
          <span style={S.currentLabel}>Đã lưu:</span>
          <span style={S.currentValue}>
            <strong>{initial.bank_name}</strong> — {initial.bank_account_number}
            {initial.bank_account_name ? ` (${initial.bank_account_name})` : ''}
          </span>
        </div>
      )}

      {error && (
        <div style={S.err}>
          <IconAlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {scan && (
        <div style={S.result}>
          <div style={S.resGrid}>
            <div style={S.field}>
              <span style={S.flabel}>Ngân hàng</span>
              <span style={S.fval}>{scan.bankShortName || scan.bankName || `BIN ${scan.bankBin}`}</span>
            </div>
            <div style={S.field}>
              <span style={S.flabel}>Số tài khoản</span>
              <span style={S.fvalCode}>{scan.accountNumber}</span>
            </div>
            <div style={S.field}>
              <span style={S.flabel}>Tên chủ tài khoản</span>
              <input
                style={S.nameInput}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Nhập tên chủ tài khoản..."
              />
            </div>
          </div>

          {scan.qrImage && (
            <div style={S.qrBox}>
              <img src={scan.qrImage} alt="QR đã chuẩn hoá" style={S.qrImg} />
              <span style={S.qrCap}>
                <IconCheckCircle size={13} color="#4f7e65" /> QR chuẩn hoá do hệ thống sinh lại
              </span>
            </div>
          )}

          <div style={S.actions}>
            <span style={S.statusText}>
              {status === 'saving' && '⏳ Đang lưu…'}
              {status === 'saved' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#4f7e65' }}>
                  <IconCheck size={14} /> Đã lưu vào thiệp
                </span>
              )}
            </span>
            <button
              type="button"
              style={S.btnSave}
              onClick={handleSave}
              disabled={status === 'saving' || !accountName.trim()}
            >
              Lưu thông tin {label}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  wrap: {
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '20px 22px',
    background: '#ffffff',
    marginTop: 14,
    boxShadow: '0 2px 8px rgba(31, 25, 23, 0.04)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'rgba(217, 119, 87, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headText: {
    flex: 1,
    minWidth: 200,
  },
  title: {
    fontSize: 14.5,
    fontWeight: 600,
    color: '#1f1917',
  },
  sub: {
    fontSize: 12,
    color: '#6e625c',
    marginTop: 2,
  },
  btnUpload: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 16px',
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 9999,
    border: '1px solid #ede5db',
    background: '#f6f1eb',
    color: '#1f1917',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  current: {
    marginTop: 14,
    padding: '10px 14px',
    background: '#f6f1eb',
    borderRadius: 10,
    fontSize: 12.5,
    color: '#5c524c',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #ede5db',
  },
  currentLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#9e918a',
  },
  currentValue: {
    fontWeight: 500,
    color: '#1f1917',
  },
  err: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'rgba(192, 73, 56, 0.08)',
    borderRadius: 10,
    fontSize: 12.5,
    color: '#c04938',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid rgba(192, 73, 56, 0.2)',
  },
  result: {
    marginTop: 16,
    borderTop: '1px dashed #ede5db',
    paddingTop: 16,
  },
  resGrid: {
    display: 'grid',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  flabel: {
    fontSize: 10.5,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#9e918a',
    fontWeight: 700,
  },
  fval: {
    fontSize: 14,
    color: '#1f1917',
    fontWeight: 600,
  },
  fvalCode: {
    fontSize: 15,
    color: '#d97757',
    fontFamily: "'Courier New', monospace",
    fontWeight: 700,
  },
  nameInput: {
    height: 38,
    padding: '0 12px',
    border: '1px solid #ede5db',
    borderRadius: 10,
    fontSize: 13.5,
    background: '#fcfaf7',
    color: '#1f1917',
  },
  qrBox: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: 16,
    background: '#fcfaf7',
    borderRadius: 14,
    border: '1px solid #ede5db',
  },
  qrImg: {
    width: 160,
    height: 160,
    borderRadius: 12,
    border: '1px solid #ede5db',
    boxShadow: '0 4px 12px rgba(31, 25, 23, 0.06)',
  },
  qrCap: {
    fontSize: 11.5,
    color: '#4f7e65',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  statusText: {
    fontSize: 12.5,
    fontWeight: 500,
  },
  btnSave: {
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 9999,
    border: 'none',
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(217, 119, 87, 0.28)',
  },
}

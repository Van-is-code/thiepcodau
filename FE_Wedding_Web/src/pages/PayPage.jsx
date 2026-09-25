import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import {
  IconQrCode,
  IconCheckCircle,
  IconAlertCircle,
  IconRefreshCw,
  IconExternalLink,
  IconHeart,
} from '../components/Icons'

const money = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`
const qrImg = (data) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${encodeURIComponent(data || '')}`

const PRODUCT_LABEL = { single: '1 thiệp cưới', combo: 'Combo 2 thiệp cưới' }

export default function PayPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const pollRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const r = await api.payPublic.get(token)
      setData(r.data?.data || r.data)
      setErr('')
    } catch (e) {
      setErr(e?.response?.data?.message || 'Không tải được thông tin thanh toán')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // Poll trạng thái mỗi 5s khi đang chờ thanh toán -> tự chuyển sang "đã thanh toán".
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (data?.status === 'pending') {
      pollRef.current = setInterval(load, 5000)
    }
    return () => pollRef.current && clearInterval(pollRef.current)
  }, [data?.status, load])

  const refresh = async () => {
    setBusy(true)
    try {
      const r = await api.payPublic.refresh(token)
      setData(r.data?.data || r.data)
      setErr('')
    } catch (e) {
      setErr(e?.response?.data?.message || 'Làm mới mã thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.bar} />
        <div style={S.body}>
          <div style={S.brand}>
            <div style={S.logo}><IconHeart size={18} color="#fff" /></div>
            <span>Thiệp Cưới Đẹp</span>
          </div>

          {loading && <p style={S.muted}>Đang tải…</p>}

          {!loading && err && !data && (
            <div style={S.errBox}><IconAlertCircle size={18} /> <span>{err}</span></div>
          )}

          {data && (
            <>
              <div style={S.summary}>
                <Row k="Dịch vụ" v={PRODUCT_LABEL[data.product_code] || data.product_code} />
                {data.customer_name && <Row k="Khách hàng" v={data.customer_name} />}
                {data.ctv_name && <Row k="Cộng tác viên" v={data.ctv_name} />}
                <Row k="Số tiền" v={<b style={{ color: '#c96547', fontSize: 18 }}>{money(data.amount)}</b>} />
              </div>

              {data.status === 'paid' && (
                <div style={{ ...S.state, ...S.stateOk }}>
                  <IconCheckCircle size={34} color="#4f7e65" />
                  <h2 style={S.h2}>Đã thanh toán</h2>
                  <p style={S.muted}>Tài khoản của bạn đã được kích hoạt. Bạn có thể đăng nhập để tạo &amp; chỉnh sửa thiệp.</p>
                  <a href="/auth" style={S.btn}>Đăng nhập</a>
                </div>
              )}

              {data.status === 'pending' && data.checkout && (
                <div style={S.state}>
                  <img
                    src={qrImg(data.checkout.qr || data.checkout.checkoutUrl)}
                    alt="Mã QR thanh toán"
                    width={220}
                    height={220}
                    style={S.qr}
                  />
                  <p style={S.muted}>Quét mã bằng app ngân hàng, hoặc bấm nút bên dưới.</p>
                  <a href={data.checkout.checkoutUrl} target="_blank" rel="noreferrer" style={S.btn}>
                    <IconExternalLink size={15} /> Mở trang thanh toán payOS
                  </a>
                  <p style={S.tiny}>
                    <IconQrCode size={12} /> Mã đơn: {data.checkout.orderCode} · Trang tự cập nhật khi thanh toán thành công.
                  </p>
                  {data.expired_at && (
                    <p style={S.tiny}>Hiệu lực đến {new Date(data.expired_at).toLocaleString('vi-VN')}</p>
                  )}
                </div>
              )}

              {(data.status === 'expired' || data.can_refresh) && data.status !== 'paid' && (
                <div style={S.state}>
                  <IconAlertCircle size={30} color="#c9902f" />
                  <h2 style={S.h2}>Mã thanh toán đã hết hạn</h2>
                  <p style={S.muted}>Bấm để tạo lại mã QR / link thanh toán mới cho đúng đơn hàng này.</p>
                  <button onClick={refresh} disabled={busy} style={S.btn}>
                    <IconRefreshCw size={15} /> {busy ? 'Đang tạo…' : 'Tạo lại mã thanh toán'}
                  </button>
                </div>
              )}

              {data.status === 'cancelled' && (
                <div style={S.state}>
                  <IconAlertCircle size={30} color="#c04938" />
                  <h2 style={S.h2}>Đơn đã bị huỷ</h2>
                  <p style={S.muted}>Vui lòng liên hệ cộng tác viên đã tạo đơn để được hỗ trợ.</p>
                </div>
              )}

              {data.status === 'refunded' && (
                <div style={S.state}>
                  <IconAlertCircle size={30} color="#c04938" />
                  <h2 style={S.h2}>Đơn đã được hoàn tiền</h2>
                </div>
              )}

              {err && <div style={S.errBox}><IconAlertCircle size={16} /> <span>{err}</span></div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div style={S.row}>
      <span style={S.rowK}>{k}</span>
      <span style={S.rowV}>{v}</span>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20,
    background: '#fcfaf7', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  card: {
    width: 'min(460px, 100%)', background: '#fff', borderRadius: 22, overflow: 'hidden',
    border: '1px solid #ede5db', boxShadow: '0 20px 50px -12px rgba(31,25,23,0.14)',
  },
  bar: { height: 5, background: 'linear-gradient(90deg,#d97757,#c9a96e)' },
  body: { padding: '26px 28px 30px' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, color: '#1f1917', marginBottom: 18 },
  logo: {
    width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#e58d6f,#c96547)',
    display: 'grid', placeItems: 'center',
  },
  summary: { background: '#f6f1eb', border: '1px solid #ede5db', borderRadius: 14, padding: '12px 16px', marginBottom: 18 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13.5 },
  rowK: { color: '#7a6f68' },
  rowV: { color: '#1f1917', fontWeight: 600, textAlign: 'right' },
  state: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  stateOk: {},
  h2: { fontSize: 20, margin: '4px 0 0', color: '#1f1917' },
  qr: { borderRadius: 12, border: '1px solid #ede5db', background: '#fff' },
  muted: { fontSize: 13.5, color: '#6e625c', lineHeight: 1.6, margin: 0 },
  tiny: { fontSize: 11.5, color: '#9a8f88', margin: 0, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', marginTop: 4,
    background: 'linear-gradient(135deg,#e58d6f,#c96547)', color: '#fff', border: 'none',
    borderRadius: 9999, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
  },
  errBox: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 14px',
    background: 'rgba(192,73,56,0.08)', color: '#c04938', borderRadius: 10, fontSize: 13,
  },
}

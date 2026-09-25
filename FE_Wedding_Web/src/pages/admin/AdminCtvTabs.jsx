import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import { useModal } from '../../components/Modal'
import {
  IconUsers, IconCreditCard, IconSliders, IconMail, IconCheckSquare, IconHelpCircle,
  IconPlus, IconSearch, IconChevronLeft, IconCheckCircle, IconAlertCircle, IconRefreshCw,
} from '../../components/Icons'

export const CTV_ADMIN_TABS = [
  { id: 'ctvs', label: 'Cộng Tác Viên', Icon: IconUsers },
  { id: 'ctv_floor', label: 'Giá Sàn', Icon: IconSliders },
  { id: 'ctv_orders', label: 'Đơn CTV', Icon: IconMail },
  { id: 'ctv_recon', label: 'Đối Soát', Icon: IconCheckSquare },
  { id: 'ctv_payouts', label: 'Phiếu Rút', Icon: IconCreditCard },
  { id: 'ctv_audit', label: 'Nhật Ký', Icon: IconHelpCircle },
]

const money = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`
const pct = (r) => `${Math.round((Number(r) || 0) * 10000) / 100}%`
const dt = (v) => (v ? new Date(v).toLocaleString('vi-VN') : '—')
const VI = {
  pending: 'Chờ TT', paid: 'Đã TT', cancelled: 'Huỷ', expired: 'Hết hạn', refunded: 'Hoàn tiền',
  pending_payment: 'Chờ kích hoạt', active: 'Hoạt động', locked: 'Khoá',
  approved: 'Đã duyệt', rejected: 'Từ chối',
}

export function CtvAdminTab({ tab }) {
  if (tab === 'ctvs') return <Ctvs />
  if (tab === 'ctv_floor') return <Floor />
  if (tab === 'ctv_orders') return <CtvOrders />
  if (tab === 'ctv_recon') return <Recon />
  if (tab === 'ctv_payouts') return <Payouts />
  if (tab === 'ctv_audit') return <Audit />
  return null
}

/* --------------------------- CTV --------------------------- */
function Ctvs() {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [f, setF] = useState({ username: '', password: '', display_name: '', phone: '', email: '', single_price: 200000, combo_price: 300000, commission_percent: 40 })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.admin.listCtvs({ search: q, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [q])
  useEffect(() => { load() }, [load])

  const create = async () => {
    setBusy(true)
    try {
      const r = await api.admin.createCtv(f)
      const c = r.data?.data || r.data
      setCreating(false)
      setF({ username: '', password: '', display_name: '', phone: '', email: '', single_price: 200000, combo_price: 300000, commission_percent: 40 })
      load()
      await modal.alert({ tone: 'success', title: 'Đã tạo CTV', message: `Đăng nhập: ${c.username}\nMật khẩu: ${c.password}` })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally { setBusy(false) }
  }

  if (openId) return <CtvDetail id={openId} onBack={() => { setOpenId(null); load() }} />

  return (
    <>
      <div style={X.toolbar}>
        <div style={X.searchBox}><IconSearch size={15} color="#9a8f88" />
          <input style={X.searchInput} placeholder="Tìm CTV" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button style={X.btnMain} onClick={() => setCreating((v) => !v)}><IconPlus size={14} /> Tạo CTV</button>
      </div>

      {creating && (
        <div style={X.panel}>
          <div style={X.formGrid}>
            <F l="Tên đăng nhập *"><input style={X.input} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></F>
            <F l="Mật khẩu *"><input style={X.input} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></F>
            <F l="Tên hiển thị"><input style={X.input} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></F>
            <F l="SĐT"><input style={X.input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></F>
            <F l="Email"><input style={X.input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></F>
            <F l="Giá thiệp lẻ (≥ 200.000)"><input style={X.input} type="number" value={f.single_price} onChange={(e) => setF({ ...f, single_price: e.target.value })} /></F>
            <F l="Giá combo (≥ 300.000)"><input style={X.input} type="number" value={f.combo_price} onChange={(e) => setF({ ...f, combo_price: e.target.value })} /></F>
            <F l="Hoa hồng (%)"><input style={X.input} type="number" value={f.commission_percent} onChange={(e) => setF({ ...f, commission_percent: e.target.value })} /></F>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button style={X.btnMain} onClick={create} disabled={busy || !f.username || !f.password}>Tạo</button>
            <button style={X.btnGhost} onClick={() => setCreating(false)}>Huỷ</button>
          </div>
        </div>
      )}
      {err && <div style={X.err}>⚠️ {err}</div>}

      <div style={X.tableWrap}>
        <table style={X.table}>
          <thead><tr><Th>CTV</Th><Th>Lẻ / Combo</Th><Th>HH</Th><Th>Số dư ví</Th><Th>Chờ rút</Th><Th>Đã trả</Th><Th>Khách</Th><Th>DT (đã TT)</Th><Th>TT</Th><Th></Th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <Td><b>{c.display_name || c.username}</b><div style={X.tiny}>{c.username}</div></Td>
                <Td>{money(c.single_price)}<br />{money(c.combo_price)}</Td>
                <Td>{pct(c.commission_rate)}</Td>
                <Td><b>{money(c.wallet?.balance)}</b></Td>
                <Td>{money(c.wallet?.pending_balance)}</Td>
                <Td>{money(c.wallet?.total_paid)}</Td>
                <Td>{c.customer_count}</Td>
                <Td>{money(c.revenue)}</Td>
                <Td><Badge s={c.status} /></Td>
                <Td><button style={X.mini} onClick={() => setOpenId(c.id)}>Mở</button></Td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} style={X.empty}>Chưa có CTV nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CtvDetail({ id, onBack }) {
  const modal = useModal()
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.admin.getCtv(id).then((r) => {
      const data = r.data?.data || r.data
      setD(data)
      setF({
        single_price: data.profile.single_price, combo_price: data.profile.combo_price,
        commission_percent: data.profile.commission_percent,
        bank_name: data.profile.bank_name || '', bank_account_number: data.profile.bank_account_number || '',
        bank_account_name: data.profile.bank_account_name || '',
        auto_payout_enabled: Boolean(data.profile.auto_payout_enabled),
        auto_payout_weekday: data.profile.auto_payout_weekday ?? '',
        auto_payout_min_amount: Number(data.profile.auto_payout_min_amount || 0),
      })
    }).catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [id])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setBusy(true)
    try { await api.admin.updateCtv(id, f); load(); await modal.alert({ tone: 'success', title: 'Đã lưu' }) }
    catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
    finally { setBusy(false) }
  }
  const toggleLock = async () => {
    const locked = d.profile.status === 'locked'
    const ok = await modal.confirm({ tone: locked ? 'default' : 'danger', title: locked ? 'Mở khoá CTV?' : 'Khoá CTV?', message: locked ? '' : 'CTV sẽ không thể tạo khách / tạo đơn / rút tiền.' })
    if (!ok) return
    try { locked ? await api.admin.unlockCtv(id) : await api.admin.lockCtv(id); load() }
    catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
  }
  const payoutForCtv = async () => {
    const ok = await modal.confirm({ title: 'Tạo phiếu rút hộ CTV?', message: `Tạo phiếu rút bằng toàn bộ số dư khả dụng (${money(d.wallet.balance)})?` })
    if (!ok) return
    const tao = async (boQuaNguong) => {
      await api.admin.createPayoutForCtv(id, d.wallet.balance, 'Admin tạo hộ', boQuaNguong)
      load()
      await modal.alert({ tone: 'success', title: 'Đã tạo phiếu rút' })
    }
    try { await tao(false) } catch (e) {
      const loi = e?.response?.data?.message || e.message
      // Dưới ngưỡng tối thiểu: hỏi lại cho admin quyết, thay vì bắt đi tắt ngưỡng
      // toàn hệ rồi bật lại.
      if (/tối thiểu/i.test(loi)) {
        const vanTao = await modal.confirm({
          tone: 'danger', title: 'Dưới mức rút tối thiểu',
          message: `${loi}

Vẫn tạo phiếu cho riêng CTV này?`,
          confirmText: 'Vẫn tạo',
        })
        if (!vanTao) return
        try { await tao(true) }
        catch (e2) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e2?.response?.data?.message || e2.message }) }
        return
      }
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: loi })
    }
  }

  if (err) return <><button style={X.btnGhost} onClick={onBack}><IconChevronLeft size={14} /> Quay lại</button><div style={X.err}>⚠️ {err}</div></>
  if (!d || !f) return <p style={X.muted}>Đang tải…</p>
  const p = d.profile; const s = d.stats

  return (
    <>
      <button style={X.btnGhost} onClick={onBack}><IconChevronLeft size={14} /> Danh sách CTV</button>
      <div style={X.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div><h3 style={X.h3}>{p.display_name || p.username}</h3><div style={X.tiny}>{p.username} · {p.phone || '—'} · {p.email || '—'}</div></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge s={p.status} big />
            <button style={X.mini} onClick={toggleLock}>{p.status === 'locked' ? 'Mở khoá' : 'Khoá'}</button>
          </div>
        </div>
        <div style={{ ...X.row, marginTop: 12 }}>
          <B l="Đơn đã TT" v={s.paid_orders} /><B l="Doanh thu" v={money(s.revenue)} />
          <B l="HH nền tảng" v={money(s.platform_commission)} /><B l="CTV được hưởng" v={money(s.ctv_earning_total)} />
          <B l="Số dư ví" v={money(s.wallet_balance)} strong /><B l="Chờ rút" v={money(s.pending_payout)} />
          <B l="Đã chi trả" v={money(s.paid_to_ctv)} /><B l="Chưa trả" v={money(s.unpaid_to_ctv)} />
          <B l="Khách" v={s.customers} />
        </div>
      </div>

      <div style={X.panel}>
        <h3 style={X.h3}>Giá & hoa hồng</h3>
        <div style={X.formGrid}>
          <F l="Giá thiệp lẻ (≥ 200.000)"><input style={X.input} type="number" value={f.single_price} onChange={(e) => setF({ ...f, single_price: e.target.value })} /></F>
          <F l="Giá combo (≥ 300.000)"><input style={X.input} type="number" value={f.combo_price} onChange={(e) => setF({ ...f, combo_price: e.target.value })} /></F>
          <F l="Hoa hồng (%)"><input style={X.input} type="number" value={f.commission_percent} onChange={(e) => setF({ ...f, commission_percent: e.target.value })} /></F>
        </div>
        <h3 style={{ ...X.h3, marginTop: 14 }}>Thông tin ngân hàng (để chuyển tiền)</h3>
        <div style={X.formGrid}>
          <F l="Ngân hàng"><input style={X.input} value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></F>
          <F l="Số tài khoản"><input style={X.input} value={f.bank_account_number} onChange={(e) => setF({ ...f, bank_account_number: e.target.value })} /></F>
          <F l="Chủ tài khoản"><input style={X.input} value={f.bank_account_name} onChange={(e) => setF({ ...f, bank_account_name: e.target.value })} /></F>
        </div>
        <h3 style={{ ...X.h3, marginTop: 14 }}>Rút tiền</h3>
        <div style={X.formGrid}>
          <F l="Rút tối thiểu riêng (₫)">
            <input style={X.input} type="number" min="0" step="10000" value={f.auto_payout_min_amount}
              onChange={(e) => setF({ ...f, auto_payout_min_amount: e.target.value })} />
          </F>
          <F l="Rút tự động">
            <select style={X.input} value={f.auto_payout_enabled ? '1' : '0'}
              onChange={(e) => setF({ ...f, auto_payout_enabled: e.target.value === '1' })}>
              <option value="0">Tắt</option><option value="1">Bật</option>
            </select>
          </F>
          <F l="Ngày quét riêng">
            <select style={X.input} value={f.auto_payout_weekday}
              onChange={(e) => setF({ ...f, auto_payout_weekday: e.target.value })}>
              <option value="">Theo mặc định toàn hệ</option>
              {['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
                .map((t, i) => <option key={i} value={i}>{t}</option>)}
            </select>
          </F>
        </div>
        <p style={X.tiny}>
          Mức riêng chỉ có tác dụng khi CAO HƠN mức tối thiểu toàn hệ (đặt ở tab Phiếu Rút).
          Đặt thấp hơn thì hệ thống vẫn lấy mức toàn hệ.
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={X.btnMain} onClick={save} disabled={busy}>Lưu thay đổi</button>
          <button style={X.btnGhost} onClick={payoutForCtv}>Tạo phiếu rút hộ CTV</button>
        </div>
        <p style={X.tiny}>Thay đổi giá / % chỉ áp dụng cho đơn tạo sau. Đơn cũ giữ nguyên giá &amp; hoa hồng đã chốt.</p>
      </div>
    </>
  )
}

/* --------------------------- Giá sàn --------------------------- */
function Floor() {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState({})

  const load = useCallback(() => {
    api.admin.listProducts().then((r) => setRows(r.data?.data || r.data)).catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (p) => {
    const v = Number(edit[p.id])
    if (!v || v <= 0) return
    try {
      const r = await api.admin.updateProduct(p.id, { base_price: v })
      const data = r.data?.data || r.data
      load()
      if (data.ctvs_below_floor?.length) {
        await modal.alert({
          tone: 'warn', title: 'Cảnh báo giá sàn',
          message: `Các CTV sau đang có giá dưới sàn mới:\n${data.ctvs_below_floor.map((c) => `• ${c.display_name}: ${money(c.price)}`).join('\n')}\n\nHãy cập nhật giá cho họ.`,
        })
      } else {
        await modal.alert({ tone: 'success', title: 'Đã cập nhật giá sàn' })
      }
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
  }

  if (err) return <div style={X.err}>⚠️ {err}</div>
  return (
    <div style={X.panel}>
      <h3 style={X.h3}>Giá sàn 2 sản phẩm gốc</h3>
      <p style={X.tiny}>CTV không được đặt giá bán thấp hơn các mức này. Ràng buộc được kiểm ở backend.</p>
      <table style={{ ...X.table, marginTop: 10 }}>
        <thead><tr><Th>Sản phẩm</Th><Th>Số thiệp</Th><Th>Giá sàn hiện tại</Th><Th>Giá sàn mới</Th><Th></Th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <Td><b>{p.name}</b> <span style={X.tiny}>({p.code})</span></Td>
              <Td>{p.card_quantity}</Td>
              <Td>{money(p.base_price)}</Td>
              <Td><input style={{ ...X.input, width: 140 }} type="number" defaultValue={p.base_price}
                onChange={(e) => setEdit({ ...edit, [p.id]: e.target.value })} /></Td>
              <Td><button style={X.mini} onClick={() => save(p)}>Lưu</button></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* --------------------------- Đơn CTV --------------------------- */
function CtvOrders() {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.admin.listCtvOrders({ status: status || undefined, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [status])
  useEffect(() => { load() }, [load])

  const refund = async (o) => {
    const ok = await modal.confirm({ tone: 'danger', title: 'Hoàn tiền đơn này?', message: 'Hệ thống sẽ đảo entitlement của khách và trừ hoa hồng đã cộng cho CTV (ghi bút toán âm, không xoá lịch sử). Việc chuyển tiền lại cho khách bạn tự thực hiện.' })
    if (!ok) return
    try { await api.admin.refundCtvOrder(o.id, 'Admin hoàn tiền'); load(); await modal.alert({ tone: 'success', title: 'Đã đánh dấu hoàn tiền' }) }
    catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
  }

  if (err) return <div style={X.err}>⚠️ {err}</div>
  return (
    <>
      <div style={X.toolbar}>
        <select style={X.input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {['pending', 'paid', 'cancelled', 'expired', 'refunded'].map((s) => <option key={s} value={s}>{VI[s]}</option>)}
        </select>
      </div>
      <div style={X.tableWrap}>
        <table style={X.table}>
          <thead><tr><Th>CTV</Th><Th>Khách</Th><Th>SP</Th><Th>Giá bán</Th><Th>Giá sàn</Th><Th>HH</Th><Th>CTV nhận</Th><Th>TT</Th><Th>Ngày</Th><Th></Th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <Td>{o.ctv?.display_name || '—'}</Td>
                <Td>{o.customer?.name || '—'}</Td>
                <Td>{o.product_code === 'combo' ? 'Combo' : '1 thiệp'}</Td>
                <Td>{money(o.ctv_selling_price)}</Td>
                <Td>{money(o.admin_base_price)}</Td>
                <Td>{money(o.commission_amount)}</Td>
                <Td><b>{money(o.ctv_earning_amount)}</b></Td>
                <Td><Badge s={o.status} /></Td>
                <Td>{dt(o.created_at)}</Td>
                <Td>{o.status === 'paid' && <button style={{ ...X.mini, ...X.miniDanger }} onClick={() => refund(o)}>Hoàn tiền</button>}</Td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} style={X.empty}>Chưa có đơn.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* --------------------------- Đối soát --------------------------- */
function Recon() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  useEffect(() => {
    api.admin.reconciliation().then((r) => setRows(r.data?.data || r.data)).catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [])
  if (err) return <div style={X.err}>⚠️ {err}</div>
  return (
    <div style={X.tableWrap}>
      <table style={X.table}>
        <thead><tr><Th>CTV</Th><Th>Ngân hàng</Th><Th>Đơn TT</Th><Th>Doanh thu</Th><Th>HH nền tảng</Th><Th>CTV được hưởng</Th><Th>Đã trả CTV</Th><Th>Chưa trả</Th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ctv_id}>
              <Td><b>{r.display_name}</b></Td>
              <Td style={X.tiny}>{r.bank.name || '—'}<br />{r.bank.number || ''} {r.bank.holder ? `· ${r.bank.holder}` : ''}</Td>
              <Td>{r.paid_orders}</Td>
              <Td>{money(r.revenue)}</Td>
              <Td>{money(r.platform_commission)}</Td>
              <Td>{money(r.ctv_earning_total)}</Td>
              <Td>{money(r.paid_to_ctv)}</Td>
              <Td><b style={{ color: r.unpaid_to_ctv > 0 ? '#c96547' : '#4f7e65' }}>{money(r.unpaid_to_ctv)}</b></Td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={8} style={X.empty}>Chưa có dữ liệu.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

/* --------------------------- Phiếu rút --------------------------- */
/* ---------- Chính sách rút tiền: mức tối thiểu + lịch quét ---------- */
/* Công tắc bật/tắt kèm giải thích HẬU QUẢ của cả hai trạng thái.
   Tiền bạc thì đừng bắt người dùng đoán bật xong chuyện gì xảy ra. */
function CongTac({ nhan, moTaBat, moTaTat, giaTri, onChange, khoa = false, lyDoKhoa = '' }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 13px', marginBottom: 8,
      border: '1px solid #ede5db', borderRadius: 11,
      background: giaTri ? '#f4faf6' : '#fbf7f2', opacity: khoa ? 0.6 : 1,
    }}>
      <label style={{ display: 'flex', alignItems: 'center', paddingTop: 2 }}>
        <input type="checkbox" checked={giaTri} disabled={khoa}
          onChange={(e) => onChange(e.target.checked)} />
      </label>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1f1917' }}>{nhan}</div>
        <div style={{ ...X.tiny, marginTop: 3 }}>{giaTri ? moTaBat : moTaTat}</div>
        {khoa && lyDoKhoa && (
          <div style={{ ...X.tiny, color: '#b07d2a', marginTop: 3 }}>{lyDoKhoa}</div>
        )}
      </div>
    </div>
  )
}

function PayoutPolicyPanel() {
  const modal = useModal()
  const [p, setP] = useState(null)
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [mo, setMo] = useState(false)
  const [uoc, setUoc] = useState(null)

  const load = useCallback(() => {
    api.admin.getPayoutPolicy()
      .then((r) => { const d = r.data?.data || r.data; setP(d); setF({ ...d }) })
      .catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  // Gõ mức sàn tới đâu, hỏi luôn xem bao nhiêu CTV sẽ bị chặn tới đó.
  useEffect(() => {
    if (!mo || !f) return
    const t = setTimeout(() => {
      api.admin.previewPayoutPolicy(Number(f.min_payout_amount) || 0)
        .then((r) => setUoc(r.data?.data || r.data))
        .catch(() => setUoc(null))
    }, 400)
    return () => clearTimeout(t)
  }, [mo, f && f.min_payout_amount])

  if (!p || !f) return null
  const doi = Number(f.min_payout_amount) !== Number(p.min_payout_amount)
    || Number(f.default_weekday) !== Number(p.default_weekday)
    || Number(f.run_hour) !== Number(p.run_hour)
    || Boolean(f.auto_sweep_enabled) !== Boolean(p.auto_sweep_enabled)
    || String(f.payout_mode) !== String(p.payout_mode)

  const save = async () => {
    setBusy(true)
    try {
      const r = await api.admin.updatePayoutPolicy({
        min_payout_amount: Number(f.min_payout_amount) || 0,
        default_weekday: Number(f.default_weekday),
        run_hour: Number(f.run_hour),
        auto_sweep_enabled: Boolean(f.auto_sweep_enabled),
        payout_mode: f.payout_mode,
      })
      const d = r.data?.data || r.data
      setP(d); setF({ ...d })
      await modal.alert({
        tone: 'success', title: 'Đã lưu chính sách rút tiền',
        message: Number(d.min_payout_amount) > 0
          ? `Từ giờ CTV phải có tối thiểu ${money(d.min_payout_amount)} mới tạo được phiếu rút.`
          : 'Đã bỏ mức rút tối thiểu — CTV rút được bất kỳ số tiền nào.',
      })
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
    finally { setBusy(false) }
  }

  const THU = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  return (
    <div style={X.panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={X.h3}>Chính sách rút tiền</h3>
          <div style={X.tiny}>
            <b>{p.payout_mode === 'payos' ? 'Chi tiền tự động qua payOS' : 'Bạn tự chuyển khoản'}</b>
            {' · '}Tự tạo phiếu: <b>{p.auto_sweep_enabled ? `${THU[p.default_weekday] || '—'} lúc ${String(p.run_hour).padStart(2, '0')}:00` : 'tắt'}</b>
            {' · '}Rút tối thiểu {Number(p.min_payout_amount) > 0 ? money(p.min_payout_amount) : 'không giới hạn'}
            {p.impact?.ctv_duoi_nguong > 0 && (
              <> · <span style={{ color: '#b07d2a' }}>{p.impact.ctv_duoi_nguong}/{p.impact.tong_ctv} CTV đang dưới ngưỡng</span></>
            )}
          </div>
        </div>
        <button style={X.btnGhost} onClick={() => setMo((v) => !v)}>{mo ? 'Đóng' : 'Sửa'}</button>
      </div>

      {mo && (
        <>
          <div style={{ marginTop: 14 }}>
            <CongTac
              bat={p.payout_mode === 'payos'}
              nhan="Tự động chuyển tiền cho CTV khi bạn duyệt phiếu"
              moTaBat="Duyệt phiếu là hệ thống gọi payOS chi tiền ngay. Bạn không phải làm gì thêm."
              moTaTat="Duyệt phiếu chỉ chốt sổ. BẠN TỰ CHUYỂN KHOẢN cho CTV rồi ghi mã giao dịch vào phiếu."
              khoa={!p.payos_ready}
              lyDoKhoa="Chưa có khoá chi hộ payOS — điền PAYOS_PAYOUT_* vào .env rồi mới bật được."
              onChange={(v) => setF({ ...f, payout_mode: v ? 'payos' : 'manual' })}
              giaTri={f.payout_mode === 'payos'}
            />
            <CongTac
              bat={Boolean(p.auto_sweep_enabled)}
              nhan="Tự động tạo phiếu rút theo lịch tuần"
              moTaBat="Mỗi tuần hệ thống tự quét ví CTV và tạo sẵn phiếu rút chờ bạn duyệt."
              moTaTat="Không tự tạo. CTV tự bấm rút, hoặc bạn tạo hộ ở trang chi tiết CTV."
              onChange={(v) => setF({ ...f, auto_sweep_enabled: v })}
              giaTri={Boolean(f.auto_sweep_enabled)}
            />
          </div>

          <div style={{ ...X.formGrid, marginTop: 12 }}>
            <F l="Rút tối thiểu (₫) — 0 là không giới hạn">
              <input style={X.input} type="number" min="0" step="10000" value={f.min_payout_amount}
                onChange={(e) => setF({ ...f, min_payout_amount: e.target.value })} />
            </F>
            {f.auto_sweep_enabled && (
              <>
                <F l="Quét tự động vào thứ">
                  <select style={X.input} value={f.default_weekday}
                    onChange={(e) => setF({ ...f, default_weekday: e.target.value })}>
                    {THU.map((t, i) => <option key={i} value={i}>{t}</option>)}
                  </select>
                </F>
                <F l="Giờ chạy (0–23)">
                  <input style={X.input} type="number" min="0" max="23" value={f.run_hour}
                    onChange={(e) => setF({ ...f, run_hour: e.target.value })} />
                </F>
              </>
            )}
          </div>

          {uoc && (
            <div style={X.tiny}>
              Ở mức {money(f.min_payout_amount)}: <b>{uoc.ctv_duoi_nguong}</b>/{uoc.tong_ctv} CTV đang có số dư
              nhưng chưa đủ ngưỡng — họ sẽ phải đợi tích thêm mới rút được.
            </div>
          )}
          <p style={X.tiny}>
            Áp cho <b>mọi</b> đường tạo phiếu: CTV tự bấm, quét tự động, và cả admin tạo hộ.
            CTV có thể tự đặt mức cao hơn cho riêng mình, nhưng không được thấp hơn mức này.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button style={X.btnMain} onClick={save} disabled={busy || !doi}>
              {busy ? 'Đang lưu…' : 'Lưu chính sách'}
            </button>
            <button style={X.btnGhost} onClick={() => setF({ ...p })} disabled={!doi}>Hoàn tác</button>
          </div>
        </>
      )}
    </div>
  )
}

function Payouts() {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('pending')
  const [err, setErr] = useState('')
  const [act, setAct] = useState(null) // { id, mode: 'approve'|'reject', ref, note }
  const [busy, setBusy] = useState(false)
  // Duyệt phiếu ở chế độ payos là TIỀN ĐI THẬT. Phải nói rõ trước khi bấm và sau
  // khi bấm, đừng để admin tưởng mới chỉ chốt sổ.
  const [tuDongChi, setTuDongChi] = useState(false)

  const load = useCallback(() => {
    api.admin.listPayoutRequests({ status: status || undefined, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [status])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.admin.getPayoutPolicy()
      .then((r) => setTuDongChi((r.data?.data || r.data)?.payout_mode === 'payos'))
      .catch(() => {})
  }, [])

  const submitAct = async () => {
    if (!act) return
    setBusy(true)
    try {
      if (act.mode === 'approve') {
        await api.admin.approvePayout(act.id, { payment_reference: act.ref || '', admin_note: act.note || '' })
      } else {
        await api.admin.rejectPayout(act.id, { admin_note: act.note || '' })
      }
      setAct(null); load()
      await modal.alert({
        tone: 'success',
        title: act.mode === 'approve' ? 'Đã duyệt phiếu rút' : 'Đã từ chối phiếu rút',
        message: act.mode !== 'approve'
          ? 'Tiền đã được hoàn lại số dư khả dụng của CTV.'
          : tuDongChi
            ? 'Đã gửi lệnh chi qua payOS — tiền đang trên đường về tài khoản CTV. '
              + 'Theo dõi trạng thái ở cột "Trạng thái" của phiếu.'
            : 'Đã chốt sổ: số dư "chờ rút" chuyển sang "đã chi trả". '
              + 'BẠN CẦN TỰ CHUYỂN KHOẢN cho CTV nếu chưa làm.',
      })
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
    finally { setBusy(false) }
  }
  const sweep = async () => {
    const ok = await modal.confirm({ title: 'Chạy quét rút tự động ngay?', message: 'Tạo phiếu rút cho các CTV đã bật rút tự động và còn số dư ≥ ngưỡng (bỏ qua điều kiện ngày trong tuần).' })
    if (!ok) return
    try {
      const r = await api.admin.runAutoSweep(true)
      const d = r.data?.data || r.data
      load()
      await modal.alert({ tone: 'success', title: 'Đã quét', message: `Tạo ${d.created?.length || 0} phiếu. Bỏ qua ${d.skipped?.length || 0} CTV.` })
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
  }

  if (err) return <div style={X.err}>⚠️ {err}</div>
  return (
    <>
      <PayoutPolicyPanel />
      <div style={X.toolbar}>
        <select style={X.input} value={status} onChange={(e) => setStatus(e.target.value)}>
          {['pending', 'approved', 'rejected', 'cancelled', ''].map((s) => <option key={s} value={s}>{s ? VI[s] : 'Tất cả'}</option>)}
        </select>
        <button style={X.btnGhost} onClick={sweep}><IconRefreshCw size={13} /> Chạy quét rút tự động</button>
      </div>
      <div style={X.tableWrap}>
        <table style={X.table}>
          <thead><tr><Th>CTV</Th><Th>Ngân hàng</Th><Th>Số tiền</Th><Th>Loại</Th><Th>Trạng thái</Th><Th>Tạo lúc</Th><Th>Ghi chú</Th><Th></Th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <React.Fragment key={p.id}>
                <tr>
                  <Td><b>{p.ctv?.display_name}</b></Td>
                  <Td style={X.tiny}>{p.ctv?.bank_name || '—'}<br />{p.ctv?.bank_account_number} {p.ctv?.bank_account_name ? `· ${p.ctv.bank_account_name}` : ''}</Td>
                  <Td><b>{money(p.amount)}</b></Td>
                  <Td>{p.type === 'auto' ? 'Tự động' : 'Thủ công'}</Td>
                  <Td><Badge s={p.status} /></Td>
                  <Td>{dt(p.created_at)}</Td>
                  <Td style={X.tiny}>{p.note || p.admin_note || ''}{p.payment_reference ? ` · CK: ${p.payment_reference}` : ''}</Td>
                  <Td>{p.status === 'pending' && act?.id !== p.id && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={X.mini} onClick={() => setAct({ id: p.id, mode: 'approve', ref: '', note: '' })}>Duyệt</button>
                      <button style={{ ...X.mini, ...X.miniDanger }} onClick={() => setAct({ id: p.id, mode: 'reject', ref: '', note: '' })}>Từ chối</button>
                    </div>
                  )}</Td>
                </tr>
                {act?.id === p.id && (
                  <tr>
                    <td colSpan={8} style={{ ...X.td, background: '#faf6f0' }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <b style={{ fontSize: 13 }}>
                          {act.mode === 'approve' ? 'Duyệt' : 'Từ chối'} phiếu {money(p.amount)} — {p.ctv?.display_name}
                        </b>
                        {act.mode === 'approve' && (tuDongChi ? (
                          <span style={{ ...X.tiny, color: '#b07d2a', maxWidth: 320 }}>
                            Bấm xác nhận là hệ thống <b>gửi lệnh chi qua payOS ngay</b> — tiền rời tài khoản
                            nền tảng. Mã giao dịch do payOS sinh, không cần nhập.
                          </span>
                        ) : (
                          <F l="Mã / nội dung chuyển khoản (bạn tự CK)">
                            <input style={X.input} value={act.ref}
                              onChange={(e) => setAct({ ...act, ref: e.target.value })} />
                          </F>
                        ))}
                        <F l={act.mode === 'approve' ? 'Ghi chú (tuỳ chọn)' : 'Lý do từ chối'}>
                          <input style={X.input} value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value })} />
                        </F>
                        <button style={X.btnMain} disabled={busy} onClick={submitAct}>Xác nhận</button>
                        <button style={X.mini} onClick={() => setAct(null)}>Huỷ</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!rows.length && <tr><td colSpan={8} style={X.empty}>Không có phiếu.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* --------------------------- Nhật ký --------------------------- */
function Audit() {
  const [rows, setRows] = useState([])
  const [action, setAction] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    api.admin.listAuditLogs({ action: action || undefined, limit: 120 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [action])
  if (err) return <div style={X.err}>⚠️ {err}</div>
  return (
    <>
      <div style={X.toolbar}>
        <input style={X.input} placeholder="Lọc theo action (vd: payment.paid)" value={action} onChange={(e) => setAction(e.target.value)} />
      </div>
      <div style={X.tableWrap}>
        <table style={X.table}>
          <thead><tr><Th>Thời gian</Th><Th>Actor</Th><Th>Hành động</Th><Th>Đối tượng</Th><Th>Trước → Sau</Th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <Td style={X.tiny}>{dt(l.created_at)}</Td>
                <Td style={X.tiny}>{l.actor_type}{l.actor_id ? `\n${String(l.actor_id).slice(0, 8)}` : ''}</Td>
                <Td><b>{l.action}</b></Td>
                <Td style={X.tiny}>{l.entity_type}<br />{l.entity_id ? String(l.entity_id).slice(0, 8) : ''}</Td>
                <Td style={{ ...X.tiny, maxWidth: 320 }}>
                  <code style={X.code}>{l.old_value ? JSON.stringify(l.old_value) : '—'}</code>
                  {' → '}
                  <code style={X.code}>{l.new_value ? JSON.stringify(l.new_value) : '—'}</code>
                </Td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} style={X.empty}>Chưa có log.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* --------------------------- helpers --------------------------- */
const F = ({ l, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 170px' }}>
    <span style={X.tiny}>{l}</span>{children}
  </label>
)
const B = ({ l, v, strong }) => (
  <div style={{ minWidth: 110 }}>
    <div style={{ fontSize: strong ? 18 : 15, fontWeight: 700, color: strong ? '#c96547' : '#1f1917' }}>{v}</div>
    <div style={X.tiny}>{l}</div>
  </div>
)
const Th = ({ children }) => <th style={X.th}>{children}</th>
const Td = ({ children, style }) => <td style={{ ...X.td, ...style }}>{children}</td>
const Badge = ({ s, big }) => {
  const map = {
    paid: ['#4f7e65', 'rgba(79,126,101,.12)'], active: ['#4f7e65', 'rgba(79,126,101,.12)'], approved: ['#4f7e65', 'rgba(79,126,101,.12)'],
    pending: ['#c9902f', 'rgba(201,144,47,.14)'], pending_payment: ['#c9902f', 'rgba(201,144,47,.14)'],
    expired: ['#8a7f78', 'rgba(138,127,120,.14)'],
    cancelled: ['#c04938', 'rgba(192,73,56,.1)'], rejected: ['#c04938', 'rgba(192,73,56,.1)'],
    refunded: ['#c04938', 'rgba(192,73,56,.1)'], locked: ['#c04938', 'rgba(192,73,56,.1)'],
  }
  const [c, bg] = map[s] || ['#6e625c', '#f0eae2']
  return <span style={{ color: c, background: bg, padding: big ? '4px 11px' : '3px 8px', borderRadius: 999, fontSize: big ? 12 : 11, fontWeight: 600 }}>{VI[s] || s}</span>
}

const X = {
  toolbar: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #ede5db', borderRadius: 10, padding: '7px 12px', flex: '1 1 220px' },
  searchInput: { border: 'none', outline: 'none', fontSize: 13.5, flex: 1, background: 'none' },
  panel: { background: '#fff', border: '1px solid #ede5db', borderRadius: 14, padding: 18, marginBottom: 14 },
  formGrid: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  input: { border: '1px solid #e0d7cc', borderRadius: 9, padding: '8px 11px', fontSize: 13.5, outline: 'none', width: '100%', background: '#fff', fontFamily: 'inherit' },
  row: { display: 'flex', gap: 20, flexWrap: 'wrap' },
  h3: { fontSize: 15, fontWeight: 700, margin: '0 0 10px' },
  tiny: { fontSize: 11.5, color: '#9a8f88', lineHeight: 1.5, whiteSpace: 'pre-line' },
  muted: { fontSize: 13.5, color: '#6e625c' },
  err: { background: 'rgba(192,73,56,.08)', color: '#c04938', padding: '10px 14px', borderRadius: 10, fontSize: 13, margin: '10px 0' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#9a8f88', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '1px solid #ede5db', whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: '1px solid #f2ece3', verticalAlign: 'top' },
  empty: { padding: 22, textAlign: 'center', color: '#9a8f88', fontSize: 13 },
  code: { fontSize: 10.5, background: '#f6f1eb', padding: '1px 4px', borderRadius: 4, wordBreak: 'break-all' },
  btnMain: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'linear-gradient(135deg,#e58d6f,#c96547)', color: '#fff', border: 'none', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f6f1eb', color: '#5c524c', border: '1px solid #ede5db', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 10 },
  mini: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#f6f1eb', color: '#5c524c', border: '1px solid #ede5db', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  miniDanger: { borderColor: 'rgba(192,73,56,0.25)', background: 'rgba(192,73,56,0.08)', color: '#c04938' },
}

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useModal } from '../../components/Modal'
import {
  IconSparkles, IconUsers, IconMail, IconCreditCard, IconSettings,
  IconChevronLeft, IconPlus, IconSearch, IconQrCode, IconRefreshCw, IconCopy,
  IconExternalLink, IconCheckCircle, IconAlertCircle, IconEdit3, IconX,
} from '../../components/Icons'

const money = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`
const payUrl = (u) => (!u ? '' : /^https?:\/\//i.test(u) ? u : `${window.location.origin}${u}`)
const pct = (r) => `${Math.round((Number(r) || 0) * 10000) / 100}%`
const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const STATUS_VI = {
  pending: 'Chờ thanh toán', paid: 'Đã thanh toán', cancelled: 'Đã huỷ',
  expired: 'Hết hạn', refunded: 'Đã hoàn tiền',
  pending_payment: 'Chờ kích hoạt', active: 'Đang hoạt động', locked: 'Bị khoá',
  approved: 'Đã duyệt', rejected: 'Từ chối',
}

const TABS = [
  { id: 'overview', label: 'Tổng Quan', Icon: IconSparkles },
  { id: 'customers', label: 'Khách Hàng', Icon: IconUsers },
  { id: 'orders', label: 'Đơn Hàng', Icon: IconMail },
  { id: 'wallet', label: 'Ví & Rút Tiền', Icon: IconCreditCard },
  { id: 'settings', label: 'Cấu Hình', Icon: IconSettings },
]

export default function CtvDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [me, setMe] = useState(null)
  const [role, setRole] = useState(null)
  const [detailId, setDetailId] = useState(null)

  useEffect(() => {
    api.getProfile()
      .then((r) => setRole((r.data?.data || r.data)?.role || 'user'))
      .catch(() => setRole('user'))
  }, [])

  const reloadMe = useCallback(() => {
    api.ctv.me().then((r) => setMe(r.data?.data || r.data)).catch(() => {})
  }, [])
  useEffect(() => { if (role === 'ctv') reloadMe() }, [role, reloadMe])

  if (role === null) return <div style={S.center}><IconSparkles size={30} color="#d97757" /><p style={S.muted}>Đang tải…</p></div>
  if (role !== 'ctv') {
    return (
      <div style={S.center}>
        <div style={S.centerCard}>
          <p style={{ color: '#c04938', fontWeight: 600, marginBottom: 14 }}>Trang này chỉ dành cho cộng tác viên.</p>
          <button style={S.btnMain} onClick={() => navigate('/dashboard')}>Về trang chính</button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={S.logo}><IconUsers size={22} color="#fff" /></div>
          <div>
            <div style={S.brand}>CTV · {me?.profile?.display_name || 'Cộng tác viên'}</div>
            <div style={S.sub}>
              Thiệp lẻ {money(me?.profile?.single_price)} · Combo {money(me?.profile?.combo_price)} · HH {pct(me?.profile?.commission_rate)}
            </div>
          </div>
        </div>
        <button style={S.btnGhost} onClick={() => navigate('/dashboard')}><IconChevronLeft size={15} /> Trang khách</button>
      </header>

      {me?.profile?.status === 'locked' && (
        <div style={S.lockedBar}><IconAlertCircle size={16} /> Tài khoản CTV của bạn đang bị khoá. Bạn không thể tạo khách / tạo đơn / rút tiền. Liên hệ quản trị viên.</div>
      )}

      <nav style={S.tabs}>
        {TABS.map((t) => {
          const On = t.Icon
          const active = tab === t.id
          return (
            <button key={t.id} style={{ ...S.tab, ...(active ? S.tabOn : {}) }}
              onClick={() => { setTab(t.id); setDetailId(null) }}>
              <On size={16} /> <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      <div style={S.body}>
        {tab === 'overview' && <Overview me={me} />}
        {tab === 'customers' && !detailId && <Customers onOpen={setDetailId} locked={me?.profile?.status === 'locked'} />}
        {tab === 'customers' && detailId && (
          <CustomerDetail id={detailId} onBack={() => setDetailId(null)} me={me} onChanged={reloadMe} />
        )}
        {tab === 'orders' && <Orders onOpenCustomer={(id) => { setTab('customers'); setDetailId(id) }} />}
        {tab === 'wallet' && <WalletTab me={me} onChanged={reloadMe} />}
        {tab === 'settings' && <SettingsTab me={me} onSaved={reloadMe} />}
      </div>
    </div>
  )
}

/* ------------------------- Tổng quan ------------------------- */
function Overview({ me }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    api.ctv.dashboard().then((r) => setD(r.data?.data || r.data)).catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [])
  if (err) return <div style={S.err}>⚠️ {err}</div>
  if (!d) return <p style={S.muted}>Đang tải số liệu…</p>

  const cards = [
    { label: 'Doanh thu tháng này', val: money(d.month.revenue), c: '#d97757' },
    { label: 'Hoa hồng tháng này', val: money(d.month.commission_earning), c: '#4f7e65' },
    { label: 'Đơn đã thanh toán (tháng)', val: d.month.paid_orders, c: '#c9a96e' },
    { label: 'Khách hàng', val: `${d.customers.active}/${d.customers.total}`, sub: 'đang hoạt động / tổng', c: '#7a6f68' },
    { label: 'Đơn chờ thanh toán', val: d.orders.pending, c: '#c9902f' },
  ]
  return (
    <>
      <div style={S.cardGrid}>
        {cards.map((c) => (
          <div key={c.label} style={S.stat}>
            <div style={{ ...S.statDot, background: c.c }} />
            <div style={S.statVal}>{c.val}</div>
            <div style={S.statLbl}>{c.label}</div>
            {c.sub && <div style={S.tiny}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div style={S.walletBox}>
        <h3 style={S.h3}>Ví của bạn</h3>
        <div style={S.walletRow}>
          <WBlock label="Số dư khả dụng" val={money(d.wallet.balance)} strong />
          <WBlock label="Đang chờ rút" val={money(d.wallet.pending_balance)} />
          <WBlock label="Tổng đã nhận" val={money(d.wallet.total_earned)} />
          <WBlock label="Đã được chi trả" val={money(d.wallet.total_paid)} />
        </div>
        {!d.wallet.ledger_consistent && (
          <p style={{ ...S.tiny, color: '#c04938' }}>⚠ Số dư lệch sổ cái — liên hệ quản trị viên.</p>
        )}
      </div>

      <div style={S.tiny}>
        Rút tự động: {me?.profile?.auto_payout_enabled
          ? `BẬT — ${me.profile.auto_payout_weekday != null ? WEEKDAYS[me.profile.auto_payout_weekday] : 'theo mặc định hệ thống'}, ngưỡng ${money(me.profile.auto_payout_min_amount)}`
          : 'TẮT (vào tab Cấu Hình để bật)'}
      </div>
    </>
  )
}
const WBlock = ({ label, val, strong }) => (
  <div style={S.wBlock}>
    <div style={{ ...S.wVal, ...(strong ? { color: '#c96547', fontSize: 20 } : {}) }}>{val}</div>
    <div style={S.tiny}>{label}</div>
  </div>
)

/* ------------------------- Khách hàng ------------------------- */
function Customers({ onOpen, locked }) {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', username: '', password: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.ctv.listCustomers({ search: q, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [q])
  useEffect(() => { load() }, [load])

  const create = async () => {
    setBusy(true)
    try {
      const r = await api.ctv.createCustomer(form)
      const c = r.data?.data || r.data
      setCreating(false)
      setForm({ name: '', phone: '', email: '', username: '', password: '' })
      load()
      await modal.alert({
        tone: 'success', title: 'Đã tạo tài khoản khách',
        message: `Bàn giao cho khách:\n\nĐăng nhập: ${c.username}\nMật khẩu: ${c.password}\n\nKhách đang ở trạng thái "Chờ kích hoạt". Hãy tạo đơn & gửi mã thanh toán để kích hoạt.`,
      })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally { setBusy(false) }
  }

  return (
    <>
      <div style={S.toolbar}>
        <div style={S.searchBox}>
          <IconSearch size={15} color="#9a8f88" />
          <input style={S.searchInput} placeholder="Tìm theo tên / SĐT / email"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button style={S.btnMain} disabled={locked} onClick={() => setCreating((v) => !v)}>
          <IconPlus size={14} /> Tạo khách
        </button>
      </div>

      {creating && (
        <div style={S.panel}>
          <div style={S.formGrid}>
            <Field label="Tên khách"><input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Số điện thoại"><input style={S.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input style={S.input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Tên đăng nhập *"><input style={S.input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Mật khẩu * (≥ 6 ký tự)"><input style={S.input} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button style={S.btnMain} onClick={create} disabled={busy || !form.username || !form.password}>Tạo</button>
            <button style={S.btnGhost} onClick={() => setCreating(false)}>Huỷ</button>
          </div>
        </div>
      )}

      {err && <div style={S.err}>⚠️ {err}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>
            <Th>Tên</Th><Th>SĐT</Th><Th>Trạng thái</Th><Th>Thiệp (còn/đã mua)</Th><Th>Tổng đã trả</Th><Th></Th>
          </tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} style={S.tr}>
                <Td><b>{c.name || c.username}</b><div style={S.tiny}>{c.username}</div></Td>
                <Td>{c.phone || '—'}</Td>
                <Td><Badge s={c.status} /></Td>
                <Td>{c.cards_available} / {c.cards_purchased} <span style={S.tiny}>(đã dùng {c.cards_used})</span></Td>
                <Td>{money(c.total_paid)}</Td>
                <Td><button style={S.mini} onClick={() => onOpen(c.id)}>Chi tiết</button></Td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} style={S.empty}>Chưa có khách hàng nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* --------------------- Chi tiết khách --------------------- */
function CustomerDetail({ id, onBack, me, onChanged }) {
  const modal = useModal()
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [cards, setCards] = useState(null)
  const [err, setErr] = useState('')
  const [product, setProduct] = useState('single')
  const [newOrder, setNewOrder] = useState(null)
  const [busy, setBusy] = useState(false)
  const locked = me?.profile?.status === 'locked'

  const load = useCallback(() => {
    api.ctv.getCustomer(id).then((r) => setD(r.data?.data || r.data)).catch((e) => setErr(e?.response?.data?.message || e.message))
    api.ctv.customerCards(id).then((r) => setCards(r.data?.data || r.data)).catch(() => {})
  }, [id])
  useEffect(() => { load() }, [load])

  const priceOf = (p) => (p === 'combo' ? me?.profile?.combo_price : me?.profile?.single_price)
  const rate = Number(me?.profile?.commission_rate || 0)
  const preview = useMemo(() => {
    const sell = Number(priceOf(product) || 0)
    const commission = Math.round(sell * rate)
    return { sell, commission, earn: sell - commission }
  }, [product, me])

  const createOrder = async () => {
    setBusy(true)
    try {
      const r = await api.ctv.createOrder(id, product)
      setNewOrder(r.data?.data || r.data)
      load(); onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Không tạo được đơn', message: e?.response?.data?.message || e.message })
    } finally { setBusy(false) }
  }

  const copy = (txt) => { navigator.clipboard?.writeText(txt); }

  if (err) return <><button style={S.btnGhost} onClick={onBack}><IconChevronLeft size={14} /> Quay lại</button><div style={S.err}>⚠️ {err}</div></>
  if (!d) return <p style={S.muted}>Đang tải…</p>
  const c = d.customer

  return (
    <>
      <button style={S.btnGhost} onClick={onBack}><IconChevronLeft size={14} /> Danh sách khách</button>

      <div style={S.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={S.h3}>{c.name || c.username}</h3>
            <div style={S.tiny}>{c.username} · {c.phone || 'chưa có SĐT'} · {c.email || 'chưa có email'}</div>
          </div>
          <Badge s={c.status} big />
        </div>
        <div style={{ ...S.walletRow, marginTop: 12 }}>
          <WBlock label="Đã mua (Purchased)" val={c.cards_purchased} />
          <WBlock label="Đã dùng (Used)" val={c.cards_used} />
          <WBlock label="Còn lại (Available)" val={c.cards_available} strong />
        </div>
      </div>

      {/* Tạo đơn mới */}
      <div style={S.panel}>
        <h3 style={S.h3}>Tạo đơn mới</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={S.radio}>
            <input type="radio" name="p" checked={product === 'single'} onChange={() => setProduct('single')} /> 1 thiệp — {money(priceOf('single'))}
          </label>
          <label style={S.radio}>
            <input type="radio" name="p" checked={product === 'combo'} onChange={() => setProduct('combo')} /> Combo 2 thiệp — {money(priceOf('combo'))}
          </label>
        </div>
        <div style={{ ...S.walletRow, marginTop: 10 }}>
          <WBlock label="Khách phải trả" val={money(preview.sell)} strong />
          <WBlock label="Hoa hồng nền tảng" val={money(preview.commission)} />
          <WBlock label="CTV nhận" val={money(preview.earn)} />
        </div>
        <p style={S.tiny}>Giá &amp; hoa hồng do hệ thống chốt tại thời điểm tạo đơn (số trên chỉ để xem trước).</p>
        <button style={S.btnMain} disabled={busy || locked} onClick={createOrder}>
          <IconQrCode size={14} /> Tạo đơn &amp; mã thanh toán
        </button>

        {newOrder && (
          <div style={S.qrCard}>
            <img alt="QR" width={180} height={180} style={S.qr}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(newOrder.checkout?.qr || newOrder.checkout?.checkoutUrl || '')}`} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={S.tiny}>Số tiền</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#c96547' }}>{money(newOrder.order?.amount)}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <a style={S.mini} href={newOrder.checkout?.checkoutUrl} target="_blank" rel="noreferrer"><IconExternalLink size={12} /> Mở payOS</a>
                <button style={S.mini} onClick={() => copy(payUrl(newOrder.pay_page_url))}><IconCopy size={12} /> Copy link cho khách</button>
              </div>
              <p style={S.tiny}>{payUrl(newOrder.pay_page_url)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Thiệp của khách */}
      <div style={S.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={S.h3}>Thiệp của khách</h3>
          {cards && <span style={S.tiny}>{cards.can_edit ? 'Có thể chỉnh sửa' : 'Chưa kích hoạt — không sửa được'}</span>}
        </div>
        {cards?.invitations?.length ? cards.invitations.map((i) => (
          <div key={i.id} style={S.cardRow}>
            <div><b>{i.title_vi || 'Thiệp cưới'}</b><div style={S.tiny}>{i.groom} &amp; {i.bride}</div></div>
            <button style={S.mini} disabled={!cards.can_edit} onClick={() => navigate(`/editor/${i.id}`)}>
              <IconEdit3 size={12} /> Sửa thiệp
            </button>
          </div>
        )) : <p style={S.tiny}>Chưa có thiệp nào.</p>}
      </div>

      {/* Lịch sử đơn */}
      <div style={S.panel}>
        <h3 style={S.h3}>Lịch sử đơn</h3>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr><Th>Sản phẩm</Th><Th>Số tiền</Th><Th>Trạng thái</Th><Th>Ngày</Th><Th></Th></tr></thead>
            <tbody>
              {d.orders.map((o) => (
                <tr key={o.id} style={S.tr}>
                  <Td>{o.product_code === 'combo' ? 'Combo 2 thiệp' : '1 thiệp'}</Td>
                  <Td>{money(o.amount)}</Td>
                  <Td><Badge s={o.status} /></Td>
                  <Td>{new Date(o.created_at).toLocaleDateString('vi-VN')}</Td>
                  <Td>{o.pay_page_url && o.status !== 'paid' && (
                    <button style={S.mini} onClick={() => copy(payUrl(o.pay_page_url))}><IconCopy size={12} /> Link</button>
                  )}</Td>
                </tr>
              ))}
              {!d.orders.length && <tr><td colSpan={5} style={S.empty}>Chưa có đơn.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ------------------------- Đơn hàng ------------------------- */
function Orders({ onOpenCustomer }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    api.ctv.listOrders({ status: status || undefined, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [status])
  return (
    <>
      <div style={S.toolbar}>
        <select style={S.input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {['pending', 'paid', 'cancelled', 'expired', 'refunded'].map((s) => <option key={s} value={s}>{STATUS_VI[s]}</option>)}
        </select>
      </div>
      {err && <div style={S.err}>⚠️ {err}</div>}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr><Th>Khách</Th><Th>Sản phẩm</Th><Th>Giá bán</Th><Th>HH nền tảng</Th><Th>CTV nhận</Th><Th>Trạng thái</Th><Th>Ngày</Th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} style={S.tr}>
                <Td><button style={S.linkBtn} onClick={() => o.customer_id && onOpenCustomer(o.customer_id)}>{o.customer?.name || '—'}</button></Td>
                <Td>{o.product_code === 'combo' ? 'Combo' : '1 thiệp'}</Td>
                <Td>{money(o.ctv_selling_price)}</Td>
                <Td>{money(o.commission_amount)}</Td>
                <Td><b>{money(o.ctv_earning_amount)}</b></Td>
                <Td><Badge s={o.status} /></Td>
                <Td>{new Date(o.created_at).toLocaleDateString('vi-VN')}</Td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} style={S.empty}>Chưa có đơn nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ------------------------- Ví & Rút tiền ------------------------- */
function WalletTab({ me, onChanged }) {
  const modal = useModal()
  const [w, setW] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const locked = me?.profile?.status === 'locked'

  const load = useCallback(() => {
    api.ctv.wallet({ limit: 50 }).then((r) => setW(r.data?.data || r.data)).catch((e) => setErr(e?.response?.data?.message || e.message))
    api.ctv.listPayouts({ limit: 50 }).then((r) => setPayouts((r.data?.data || r.data).items || [])).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    const v = Number(amount)
    if (!v || v <= 0) return
    setBusy(true)
    try {
      await api.ctv.createPayout(v, note)
      setAmount(''); setNote(''); load(); onChanged?.()
      await modal.alert({ tone: 'success', title: 'Đã gửi yêu cầu rút', message: 'Quản trị viên sẽ duyệt và chuyển khoản. Số tiền đã được tạm giữ khỏi số dư khả dụng.' })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally { setBusy(false) }
  }

  const cancel = async (id) => {
    const ok = await modal.confirm({ tone: 'warn', title: 'Huỷ phiếu rút?', message: 'Số tiền sẽ được hoàn lại số dư khả dụng.' })
    if (!ok) return
    try { await api.ctv.cancelPayout(id); load(); onChanged?.() }
    catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
  }

  if (err) return <div style={S.err}>⚠️ {err}</div>
  if (!w) return <p style={S.muted}>Đang tải…</p>
  const s = w.summary

  return (
    <>
      <div style={S.walletBox}>
        <div style={S.walletRow}>
          <WBlock label="Số dư khả dụng" val={money(s.balance)} strong />
          <WBlock label="Đang chờ rút" val={money(s.pending_balance)} />
          <WBlock label="Tổng đã nhận" val={money(s.total_earned)} />
          <WBlock label="Đã được chi trả" val={money(s.total_paid)} />
        </div>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Tạo phiếu rút tiền</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Số tiền muốn rút (₫)">
            <input style={S.input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Tối đa ${money(s.balance)}`} />
          </Field>
          <Field label="Ghi chú (tuỳ chọn)">
            <input style={S.input} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button style={S.btnMain} disabled={busy || locked || !Number(amount)} onClick={submit}>Gửi yêu cầu</button>
          <button style={S.btnGhost} onClick={() => setAmount(String(s.balance))}>Rút hết</button>
        </div>
        <p style={S.tiny}>Chỉ được có 1 phiếu chờ duyệt tại một thời điểm. Admin duyệt xong sẽ chuyển khoản theo thông tin ngân hàng ở tab Cấu Hình.</p>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Phiếu rút của bạn</h3>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr><Th>Số tiền</Th><Th>Loại</Th><Th>Trạng thái</Th><Th>Ngày tạo</Th><Th>Mã CK</Th><Th></Th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} style={S.tr}>
                  <Td><b>{money(p.amount)}</b></Td>
                  <Td>{p.type === 'auto' ? 'Tự động' : 'Thủ công'}</Td>
                  <Td><Badge s={p.status} /></Td>
                  <Td>{new Date(p.created_at).toLocaleString('vi-VN')}</Td>
                  <Td>{p.payment_reference || '—'}</Td>
                  <Td>{p.status === 'pending' && <button style={S.mini} onClick={() => cancel(p.id)}>Huỷ</button>}</Td>
                </tr>
              ))}
              {!payouts.length && <tr><td colSpan={6} style={S.empty}>Chưa có phiếu rút.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Sổ cái ví (gần đây)</h3>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr><Th>Thời gian</Th><Th>Loại</Th><Th>Biến động</Th><Th>Số dư sau</Th><Th>Ghi chú</Th></tr></thead>
            <tbody>
              {(w.ledger?.items || []).map((t) => (
                <tr key={t.id} style={S.tr}>
                  <Td>{new Date(t.created_at).toLocaleString('vi-VN')}</Td>
                  <Td>{LEDGER_VI[t.type] || t.type}</Td>
                  <Td style={{ color: Number(t.amount) < 0 ? '#c04938' : '#4f7e65', fontWeight: 600 }}>
                    {Number(t.amount) > 0 ? '+' : ''}{money(t.amount)}
                  </Td>
                  <Td>{money(t.balance_after)}</Td>
                  <Td style={S.tiny}>{t.note}</Td>
                </tr>
              ))}
              {!(w.ledger?.items || []).length && <tr><td colSpan={5} style={S.empty}>Chưa có giao dịch.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
const LEDGER_VI = {
  commission_credit: 'Hoa hồng', refund_debit: 'Đảo hoàn tiền',
  payout_hold: 'Giữ tiền rút', payout_release: 'Nhả tiền rút', adjustment: 'Điều chỉnh',
}

/* ------------------------- Cấu hình ------------------------- */
function SettingsTab({ me, onSaved }) {
  const modal = useModal()
  const p = me?.profile || {}
  const [f, setF] = useState({
    auto_payout_enabled: !!p.auto_payout_enabled,
    auto_payout_weekday: p.auto_payout_weekday ?? '',
    auto_payout_min_amount: p.auto_payout_min_amount ?? 0,
    bank_name: p.bank_name || '', bank_account_number: p.bank_account_number || '', bank_account_name: p.bank_account_name || '',
  })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setF({
      auto_payout_enabled: !!p.auto_payout_enabled,
      auto_payout_weekday: p.auto_payout_weekday ?? '',
      auto_payout_min_amount: p.auto_payout_min_amount ?? 0,
      bank_name: p.bank_name || '', bank_account_number: p.bank_account_number || '', bank_account_name: p.bank_account_name || '',
    })
  }, [me])

  const save = async () => {
    setBusy(true)
    try {
      await api.ctv.updatePayoutSettings({
        ...f,
        auto_payout_weekday: f.auto_payout_weekday === '' ? null : Number(f.auto_payout_weekday),
        auto_payout_min_amount: Number(f.auto_payout_min_amount) || 0,
      })
      onSaved?.()
      await modal.alert({ tone: 'success', title: 'Đã lưu', message: 'Cấu hình rút tiền đã được cập nhật.' })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally { setBusy(false) }
  }

  return (
    <>
      <div style={S.panel}>
        <h3 style={S.h3}>Bảng giá &amp; hoa hồng (do quản trị viên quy định)</h3>
        <div style={S.walletRow}>
          <WBlock label="Giá thiệp lẻ" val={money(p.single_price)} />
          <WBlock label="Giá combo 2 thiệp" val={money(p.combo_price)} />
          <WBlock label="Tỉ lệ hoa hồng" val={pct(p.commission_rate)} />
        </div>
        <p style={S.tiny}>Bạn không thể tự đổi các giá trị này. Liên hệ quản trị viên nếu cần điều chỉnh.</p>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Thông tin nhận tiền</h3>
        <div style={S.formGrid}>
          <Field label="Ngân hàng"><input style={S.input} value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></Field>
          <Field label="Số tài khoản"><input style={S.input} value={f.bank_account_number} onChange={(e) => setF({ ...f, bank_account_number: e.target.value })} /></Field>
          <Field label="Chủ tài khoản"><input style={S.input} value={f.bank_account_name} onChange={(e) => setF({ ...f, bank_account_name: e.target.value })} /></Field>
        </div>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Rút tiền tự động</h3>
        <label style={S.radio}>
          <input type="checkbox" checked={f.auto_payout_enabled} onChange={(e) => setF({ ...f, auto_payout_enabled: e.target.checked })} />
          Bật tạo phiếu rút tự động hằng tuần
        </label>
        <div style={{ ...S.formGrid, marginTop: 10 }}>
          <Field label="Ngày trong tuần">
            <select style={S.input} value={f.auto_payout_weekday} onChange={(e) => setF({ ...f, auto_payout_weekday: e.target.value })}>
              <option value="">Theo mặc định hệ thống</option>
              {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
            </select>
          </Field>
          <Field label="Ngưỡng tối thiểu (₫)">
            <input style={S.input} type="number" value={f.auto_payout_min_amount}
              onChange={(e) => setF({ ...f, auto_payout_min_amount: e.target.value })} />
          </Field>
        </div>
        <p style={S.tiny}>Đến ngày đã chọn, nếu số dư khả dụng ≥ ngưỡng, hệ thống tự tạo 1 phiếu rút bằng đúng số dư. Admin vẫn duyệt &amp; chuyển khoản thủ công.</p>
      </div>

      <button style={S.btnMain} disabled={busy} onClick={save}>Lưu cấu hình</button>
    </>
  )
}

/* ------------------------- UI helpers ------------------------- */
const Field = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
    <span style={S.tiny}>{label}</span>{children}
  </label>
)
const Th = ({ children }) => <th style={S.th}>{children}</th>
const Td = ({ children, style }) => <td style={{ ...S.td, ...style }}>{children}</td>
const Badge = ({ s, big }) => {
  const map = {
    paid: ['#4f7e65', 'rgba(79,126,101,.12)'], active: ['#4f7e65', 'rgba(79,126,101,.12)'],
    approved: ['#4f7e65', 'rgba(79,126,101,.12)'],
    pending: ['#c9902f', 'rgba(201,144,47,.14)'], pending_payment: ['#c9902f', 'rgba(201,144,47,.14)'],
    expired: ['#8a7f78', 'rgba(138,127,120,.14)'],
    cancelled: ['#c04938', 'rgba(192,73,56,.1)'], rejected: ['#c04938', 'rgba(192,73,56,.1)'],
    refunded: ['#c04938', 'rgba(192,73,56,.1)'], locked: ['#c04938', 'rgba(192,73,56,.1)'],
  }
  const [c, bg] = map[s] || ['#6e625c', '#f0eae2']
  return <span style={{ color: c, background: bg, padding: big ? '5px 12px' : '3px 9px', borderRadius: 999, fontSize: big ? 12.5 : 11.5, fontWeight: 600 }}>{STATUS_VI[s] || s}</span>
}

const S = {
  page: { maxWidth: 1080, margin: '0 auto', padding: '20px 18px 60px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#1f1917' },
  center: { minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', gap: 10 },
  centerCard: { background: '#fff', border: '1px solid #ede5db', borderRadius: 16, padding: 30 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  logo: { width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#e58d6f,#c96547)', display: 'grid', placeItems: 'center' },
  brand: { fontWeight: 700, fontSize: 16 },
  sub: { fontSize: 12, color: '#7a6f68' },
  lockedBar: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(192,73,56,.08)', color: '#c04938', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12 },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #ede5db', marginBottom: 18 },
  tab: { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', border: 'none', background: 'none', color: '#7a6f68', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid transparent' },
  tabOn: { color: '#c96547', borderBottomColor: '#c96547' },
  body: { minHeight: 200 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 16 },
  stat: { background: '#fff', border: '1px solid #ede5db', borderRadius: 14, padding: 16, position: 'relative' },
  statDot: { width: 30, height: 4, borderRadius: 4, marginBottom: 10 },
  statVal: { fontSize: 20, fontWeight: 700 },
  statLbl: { fontSize: 12.5, color: '#7a6f68', marginTop: 2 },
  walletBox: { background: '#fff', border: '1px solid #ede5db', borderRadius: 14, padding: 18, marginBottom: 16 },
  walletRow: { display: 'flex', gap: 22, flexWrap: 'wrap' },
  wBlock: { minWidth: 120 },
  wVal: { fontSize: 16, fontWeight: 700 },
  h3: { fontSize: 15, fontWeight: 700, margin: '0 0 10px' },
  tiny: { fontSize: 11.5, color: '#9a8f88', lineHeight: 1.5 },
  muted: { fontSize: 13.5, color: '#6e625c' },
  err: { background: 'rgba(192,73,56,.08)', color: '#c04938', padding: '10px 14px', borderRadius: 10, fontSize: 13, margin: '10px 0' },
  toolbar: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #ede5db', borderRadius: 10, padding: '7px 12px', flex: '1 1 220px' },
  searchInput: { border: 'none', outline: 'none', fontSize: 13.5, flex: 1, background: 'none' },
  panel: { background: '#fff', border: '1px solid #ede5db', borderRadius: 14, padding: 18, marginBottom: 14 },
  formGrid: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  input: { border: '1px solid #e0d7cc', borderRadius: 9, padding: '8px 11px', fontSize: 13.5, outline: 'none', width: '100%', background: '#fff', fontFamily: 'inherit' },
  radio: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, cursor: 'pointer' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#9a8f88', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '1px solid #ede5db', whiteSpace: 'nowrap' },
  td: { padding: '10px', borderBottom: '1px solid #f2ece3', verticalAlign: 'top' },
  tr: {},
  empty: { padding: 24, textAlign: 'center', color: '#9a8f88', fontSize: 13 },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f2ece3' },
  qrCard: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 14, padding: 14, background: '#faf6f0', borderRadius: 12, border: '1px solid #ede5db' },
  qr: { borderRadius: 10, border: '1px solid #ede5db', background: '#fff' },
  btnMain: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'linear-gradient(135deg,#e58d6f,#c96547)', color: '#fff', border: 'none', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f6f1eb', color: '#5c524c', border: '1px solid #ede5db', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 10 },
  mini: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#f6f1eb', color: '#5c524c', border: '1px solid #ede5db', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' },
  linkBtn: { background: 'none', border: 'none', color: '#c96547', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13 },
}

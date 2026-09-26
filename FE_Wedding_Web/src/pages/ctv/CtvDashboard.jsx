import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useModal } from '../../components/Modal'
import {
  IconSparkles,
  IconUsers,
  IconMail,
  IconPalette,
  IconCreditCard,
  IconSettings,
  IconChevronLeft,
  IconPlus,
  IconSearch,
  IconQrCode,
  IconRefreshCw,
  IconCopy,
  IconExternalLink,
  IconCheckCircle,
  IconAlertCircle,
  IconEdit3,
  IconX,
  IconKey,
  IconLock,
  IconUnlock,
  IconEye,
} from '../../components/Icons'

const money = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`
const payUrl = (u) => (!u ? '' : /^https?:\/\//i.test(u) ? u : `${window.location.origin}${u}`)
const pct = (r) => `${Math.round((Number(r) || 0) * 10000) / 100}%`
const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const STATUS_VI = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  cancelled: 'Đã huỷ',
  expired: 'Hết hạn',
  refunded: 'Đã hoàn tiền',
  pending_payment: 'Chờ kích hoạt',
  active: 'Đang hoạt động',
  locked: 'Bị khoá',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}

const TABS = [
  { id: 'overview', label: 'Tổng Quan', Icon: IconSparkles },
  { id: 'customers', label: 'Tài Khoản Khách', Icon: IconUsers },
  { id: 'invitations', label: 'Quản Lý Thiệp', Icon: IconMail },
  { id: 'templates', label: 'Kho Mẫu Thiệp', Icon: IconPalette },
  { id: 'orders', label: 'Đơn Hàng', Icon: IconCreditCard },
  { id: 'wallet', label: 'Ví & Rút Tiền', Icon: IconCreditCard },
  { id: 'settings', label: 'Cấu Hình', Icon: IconSettings },
]

export default function CtvDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [me, setMe] = useState(null)
  const [role, setRole] = useState(null)

  useEffect(() => {
    api.getProfile()
      .then((r) => setRole((r.data?.data || r.data)?.role || 'user'))
      .catch(() => setRole('user'))
  }, [])

  const reloadMe = useCallback(() => {
    api.ctv.me()
      .then((r) => setMe(r.data?.data || r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (role === 'ctv' || role === 'admin') reloadMe()
  }, [role, reloadMe])

  if (role === null) {
    return (
      <div style={S.center}>
        <div style={S.centerCard}>
          <IconSparkles size={32} color="#d97757" />
          <p style={{ marginTop: 12, fontSize: 14, color: '#5c524c' }}>Đang xác thực thông tin CTV...</p>
        </div>
      </div>
    )
  }

  if (role !== 'ctv' && role !== 'admin') {
    return (
      <div style={S.center}>
        <div style={S.centerCard}>
          <p style={{ color: '#c04938', fontWeight: 600, marginBottom: 14 }}>
            Trang này chỉ dành cho cộng tác viên.
          </p>
          <button style={S.btnMain} onClick={() => navigate('/dashboard')}>
            Về Trang Chính
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={S.logoBadge}>
            <IconUsers size={22} color="#fff" />
          </div>
          <div>
            <div style={S.brand}>CTV · {me?.profile?.display_name || 'Cộng Tác Viên'}</div>
            <div style={S.sub}>
              Cấp tài khoản khách, tạo thiệp hộ & quản lý hoa hồng | Đơn giá: {money(me?.profile?.single_price)} · Combo: {money(me?.profile?.combo_price)} · HH: {pct(me?.profile?.commission_rate)}
            </div>
          </div>
        </div>
        <button style={S.btnGhost} onClick={() => navigate('/dashboard')}>
          <IconChevronLeft size={15} />
          <span>Về Trang Khách</span>
        </button>
      </header>

      {me?.profile?.status === 'locked' && (
        <div style={S.lockedBar}>
          <IconAlertCircle size={16} /> Tài khoản CTV của bạn đang bị khoá. Bạn không thể tạo khách / tạo đơn / rút tiền. Vui lòng liên hệ quản trị viên.
        </div>
      )}

      <nav style={S.tabs}>
        {TABS.map((t) => {
          const TabIcon = t.Icon
          const isOn = tab === t.id
          return (
            <button
              key={t.id}
              style={{ ...S.tab, ...(isOn ? S.tabOn : {}) }}
              onClick={() => setTab(t.id)}
            >
              <TabIcon size={16} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      <div style={S.body}>
        {tab === 'overview' && <Overview me={me} onOpenTab={setTab} />}
        {tab === 'customers' && (
          <Customers me={me} locked={me?.profile?.status === 'locked'} onChanged={reloadMe} navigate={navigate} />
        )}
        {tab === 'invitations' && (
          <InvitationsTab me={me} navigate={navigate} onOpenCustomers={() => setTab('customers')} />
        )}
        {tab === 'templates' && (
          <TemplatesTab me={me} navigate={navigate} onOpenCustomers={() => setTab('customers')} />
        )}
        {tab === 'orders' && <OrdersTab onOpenCustomer={() => setTab('customers')} />}
        {tab === 'wallet' && <WalletTab me={me} onChanged={reloadMe} />}
        {tab === 'settings' && <SettingsTab me={me} onSaved={reloadMe} />}
      </div>
    </div>
  )
}

/* =========================================================================
   1. OVERVIEW TAB
   ========================================================================= */
function Overview({ me, onOpenTab }) {
  const [d, setD] = useState(null)
  const [recentInvs, setRecentInvs] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    api.ctv.dashboard()
      .then((r) => setD(r.data?.data || r.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message))

    api.ctv.listInvitations({ limit: 5 })
      .then((r) => setRecentInvs((r.data?.data || r.data).items || []))
      .catch(() => {})
  }, [])

  if (err) return <div style={S.err}>⚠️ {err}</div>
  if (!d) return <div style={{ padding: 40, textAlign: 'center', color: '#6e625c' }}>Đang tải số liệu thống kê...</div>

  const cards = [
    { label: 'Doanh thu tháng này', val: money(d.month.revenue), Icon: IconSparkles, color: '#d97757' },
    { label: 'Hoa hồng tháng này', val: money(d.month.commission_earning), Icon: IconCreditCard, color: '#4f7e65' },
    { label: 'Đơn đã thanh toán (tháng)', val: d.month.paid_orders, Icon: IconCheckCircle, color: '#c9a96e' },
    { label: 'Khách hàng', val: `${d.customers.active}/${d.customers.total}`, sub: 'đang hoạt động / tổng', Icon: IconUsers, color: '#5b7bb2' },
    { label: 'Đơn chờ thanh toán', val: d.orders.pending, Icon: IconAlertCircle, color: '#c9902f' },
  ]

  return (
    <div>
      <div style={S.statGrid}>
        {cards.map((c) => {
          const CardIcon = c.Icon
          return (
            <div key={c.label} style={S.stat}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={S.statKey}>{c.label}</span>
                <CardIcon size={18} color={c.color} />
              </div>
              <div style={{ ...S.statVal, color: c.color }}>{c.val}</div>
              {c.sub && <div style={{ fontSize: 11.5, color: '#9e918a', marginTop: 4 }}>{c.sub}</div>}
            </div>
          )
        })}
      </div>

      <div style={S.walletBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>Ví Hoa Hồng &amp; Thu Hộ</h3>
          <button style={S.mini} onClick={() => onOpenTab('wallet')}>
            Quản lý ví &amp; Rút tiền →
          </button>
        </div>
        <div style={S.walletRow}>
          <WBlock label="Số dư khả dụng" val={money(d.wallet.balance)} strong color="#c96547" />
          <WBlock label="Đang chờ rút" val={money(d.wallet.pending_balance)} />
          <WBlock label="Tổng đã nhận" val={money(d.wallet.total_earned)} />
          <WBlock label="Đã được chi trả" val={money(d.wallet.total_paid)} />
        </div>
        {!d.wallet.ledger_consistent && (
          <p style={{ ...S.tiny, color: '#c04938', marginTop: 10 }}>⚠ Số dư lệch sổ cái — liên hệ quản trị viên.</p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px' }}>
        <h3 style={{ ...S.h3, margin: 0 }}>Thiệp Của Khách Mới Tạo Gần Đây</h3>
        <button style={S.mini} onClick={() => onOpenTab('invitations')}>
          Xem tất cả thiệp →
        </button>
      </div>

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Tiêu Đề Thiệp</th>
              <th style={S.th}>Đường Dẫn (Slug)</th>
              <th style={S.th}>Khách Hàng</th>
              <th style={S.th}>Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            {recentInvs.map((r) => (
              <tr key={r.id}>
                <td style={S.td}>
                  <strong>{r.title_vi || 'Thiệp cưới'}</strong>
                  <div style={{ fontSize: 11.5, color: '#6e625c' }}>
                    {r.groom?.name_groom || 'Chú rể'} &amp; {r.bride?.name_bride || 'Cô dâu'}
                  </div>
                </td>
                <td style={S.td}>
                  <code style={S.code}>{r.invitation_slug}</code>
                </td>
                <td style={S.td}>
                  <strong>{r.customer?.username || r.user?.username || '—'}</strong>
                  {r.customer?.name && <div style={{ fontSize: 11.5, color: '#6e625c' }}>{r.customer.name}</div>}
                </td>
                <td style={S.td}>
                  {r.lock_state?.locked ? (
                    <span style={S.pillLock}><IconLock size={12} /> Khoá sửa</span>
                  ) : (
                    <span style={S.pillOk}><IconCheckCircle size={12} /> Đang mở</span>
                  )}
                </td>
              </tr>
            ))}
            {!recentInvs.length && (
              <tr>
                <td colSpan={4} style={S.empty}>Chưa có thiệp nào được tạo.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const WBlock = ({ label, val, strong, color }) => (
  <div style={S.wBlock}>
    <div style={{ ...S.wVal, ...(strong ? { color: color || '#c96547', fontSize: 20 } : {}) }}>{val}</div>
    <div style={S.tiny}>{label}</div>
  </div>
)

/* =========================================================================
   2. CUSTOMERS TAB (Tài Khoản Khách)
   ========================================================================= */
function Customers({ me, locked, onChanged, navigate }) {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '', email: '' })
  const [expandedId, setExpandedId] = useState('')

  // Order modal state
  const [orderModalCustomer, setOrderModalCustomer] = useState(null)
  const [orderProduct, setOrderProduct] = useState('single')
  const [newOrder, setNewOrder] = useState(null)
  const [orderBusy, setOrderBusy] = useState(false)

  const load = useCallback(() => {
    api.ctv.listCustomers({ search: q, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  const createCustomer = async () => {
    if (!form.username || !form.password) {
      await modal.alert({ title: 'Thiếu thông tin', message: 'Vui lòng nhập tên đăng nhập và mật khẩu cho khách.' })
      return
    }
    setBusy(true)
    try {
      const r = await api.ctv.createCustomer(form)
      const c = r.data?.data || r.data
      setForm({ username: '', password: '', name: '', phone: '', email: '' })
      load()
      onChanged?.()
      await modal.alert({
        tone: 'success',
        title: 'Đã tạo tài khoản khách thành công',
        message: `Thông tin bàn giao cho khách:\n\n• Tên đăng nhập: ${c.username}\n• Mật khẩu: ${c.password}\n\nTrạng thái: "Chờ kích hoạt". Hãy bấm "Tạo đơn & QR" để gửi mã thanh toán cho khách hoặc "Quản lý thiệp" để tạo mẫu thiệp trước cho khách.`,
      })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async (cust) => {
    const v = window.prompt(`Nhập mật khẩu mới cho tài khoản "${cust.username}":`, '')
    if (!v) return
    try {
      await api.ctv.resetCustomerPassword(cust.id, v)
      await modal.alert({ tone: 'success', title: 'Thành công', message: `Đã đổi mật khẩu cho tài khoản "${cust.username}".` })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const editInfo = async (cust) => {
    const newName = window.prompt('Họ và tên khách hàng:', cust.name || '')
    if (newName === null) return
    const newPhone = window.prompt('Số điện thoại khách hàng:', cust.phone || '')
    if (newPhone === null) return
    const newEmail = window.prompt('Email khách hàng:', cust.email || '')
    if (newEmail === null) return
    try {
      await api.ctv.updateCustomer(cust.id, { name: newName, phone: newPhone, email: newEmail })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const openOrderModal = (cust) => {
    setOrderModalCustomer(cust)
    setOrderProduct('single')
    setNewOrder(null)
  }

  const submitOrder = async () => {
    if (!orderModalCustomer) return
    setOrderBusy(true)
    try {
      const r = await api.ctv.createOrder(orderModalCustomer.id, orderProduct)
      setNewOrder(r.data?.data || r.data)
      load()
      onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Không tạo được đơn', message: e?.response?.data?.message || e.message })
    } finally {
      setOrderBusy(false)
    }
  }

  const copy = (txt) => {
    navigator.clipboard?.writeText(txt)
    alert('Đã sao chép vào bộ nhớ tạm!')
  }

  return (
    <div>
      {/* Box tạo tài khoản khách */}
      <div style={S.createBox}>
        <div style={S.createTitle}>
          <IconPlus size={16} color="#d97757" />
          <span>Cấp Mới Tài Khoản Khách Hàng</span>
        </div>
        <div style={S.createRow}>
          <input
            style={S.input}
            placeholder="Tên đăng nhập (username) *"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            style={S.input}
            placeholder="Mật khẩu *"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <input
            style={S.input}
            placeholder="Họ tên khách"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            style={S.input}
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            style={S.input}
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <button style={S.btnMain} onClick={createCustomer} disabled={busy || locked}>
            <IconPlus size={14} />
            <span>{busy ? 'Đang tạo...' : 'Tạo Tài Khoản Khách'}</span>
          </button>
        </div>
      </div>

      {/* Tìm kiếm */}
      <div style={{ position: 'relative', width: 320, margin: '6px 0 14px' }}>
        <input
          style={{ ...S.input, width: '100%', paddingLeft: 36 }}
          placeholder="Tìm theo username, tên hoặc SĐT..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9e918a', display: 'flex' }}>
          <IconSearch size={15} />
        </span>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      {/* Bảng khách hàng */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Tên Đăng Nhập &amp; Họ Tên</th>
              <th style={S.th}>Liên Hệ</th>
              <th style={S.th}>Lượt Tạo Thiệp</th>
              <th style={S.th}>Trạng Thái</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <React.Fragment key={c.id}>
                <tr>
                  <td style={S.td}>
                    <strong>{c.username}</strong>
                    {c.name && <div style={{ fontSize: 12, color: '#6e625c' }}>{c.name}</div>}
                  </td>
                  <td style={S.td}>
                    <div>{c.phone || '—'}</div>
                    <div style={{ fontSize: 11.5, color: '#9e918a' }}>{c.email || 'Chưa có email'}</div>
                  </td>
                  <td style={S.td}>
                    <strong style={{ color: '#d97757', fontSize: 14 }}>{c.cards_available ?? 0}</strong> lượt khả dụng
                    <div style={{ fontSize: 11.5, color: '#9e918a' }}>
                      (Đã mua: {c.cards_purchased} · Đã dùng: {c.cards_used})
                    </div>
                  </td>
                  <td style={S.td}>
                    <Badge s={c.status} />
                  </td>
                  <td style={S.td}>
                    <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                      <button
                        style={{ ...S.mini, ...(expandedId === c.id ? S.miniActive : {}) }}
                        onClick={() => setExpandedId((v) => (v === c.id ? '' : c.id))}
                      >
                        <IconMail size={12} /> {expandedId === c.id ? 'Đóng thiệp' : 'Quản lý thiệp'}
                      </button>
                      <button style={S.mini} onClick={() => openOrderModal(c)}>
                        <IconQrCode size={12} /> Tạo đơn &amp; QR
                      </button>
                      <button style={S.mini} onClick={() => resetPassword(c)}>
                        <IconKey size={12} /> Mật khẩu
                      </button>
                      <button style={S.mini} onClick={() => editInfo(c)}>
                        <IconEdit3 size={12} /> Sửa
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Panel mở rộng quản lý thiệp & tạo thiệp hộ khách */}
                {expandedId === c.id && (
                  <tr>
                    <td colSpan={5} style={{ ...S.td, background: '#faf6f0', padding: 0 }}>
                      <CustomerCardManager
                        customer={c}
                        navigate={navigate}
                        modal={modal}
                        locked={locked}
                        onChanged={load}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} style={S.empty}>Chưa có tài khoản khách nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tạo đơn & QR thanh toán */}
      {orderModalCustomer && (
        <div style={S.modalOverlay}>
          <div style={S.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ ...S.h3, margin: 0 }}>Tạo Đơn Thanh Toán Cho: {orderModalCustomer.username}</h3>
              <button style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setOrderModalCustomer(null)}>
                <IconX size={18} color="#6e625c" />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
              <label style={S.radio}>
                <input
                  type="radio"
                  name="pm"
                  checked={orderProduct === 'single'}
                  onChange={() => setOrderProduct('single')}
                />
                1 thiệp lẻ ({money(me?.profile?.single_price)})
              </label>
              <label style={S.radio}>
                <input
                  type="radio"
                  name="pm"
                  checked={orderProduct === 'combo'}
                  onChange={() => setOrderProduct('combo')}
                />
                Combo 2 thiệp ({money(me?.profile?.combo_price)})
              </label>
            </div>

            <button
              style={{ ...S.btnMain, width: '100%', justifyContent: 'center' }}
              onClick={submitOrder}
              disabled={orderBusy || locked}
            >
              <IconQrCode size={14} />
              <span>{orderBusy ? 'Đang tạo đơn...' : 'Tạo Đơn & Lấy Mã QR'}</span>
            </button>

            {newOrder && (
              <div style={{ ...S.qrCard, marginTop: 16 }}>
                <img
                  alt="QR Thanh Toán"
                  width={180}
                  height={180}
                  style={S.qr}
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(newOrder.checkout?.qr || newOrder.checkout?.checkoutUrl || '')}`}
                />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={S.tiny}>Số tiền cần thanh toán</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#c96547' }}>
                    {money(newOrder.order?.amount)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <a style={S.mini} href={newOrder.checkout?.checkoutUrl} target="_blank" rel="noreferrer">
                      <IconExternalLink size={12} /> Mở cổng payOS
                    </a>
                    <button style={S.mini} onClick={() => copy(payUrl(newOrder.pay_page_url))}>
                      <IconCopy size={12} /> Copy link cho khách
                    </button>
                  </div>
                  <p style={{ ...S.tiny, marginTop: 8, wordBreak: 'break-all' }}>
                    Link thanh toán: {payUrl(newOrder.pay_page_url)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------
   Panel quản lý thiệp & tạo thiệp hộ cho 1 khách hàng cụ thể
   ------------------------------------------------------------------------- */
function CustomerCardManager({ customer, navigate, modal, locked, onChanged }) {
  const [cards, setCards] = useState(null)
  const [templates, setTemplates] = useState([])
  const [tplId, setTplId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.ctv.customerCards(customer.id)
      .then((r) => setCards(r.data?.data || r.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [customer.id])

  useEffect(() => {
    load()
    api.getTemplates()
      .then((r) => {
        const list = (r.data?.data?.items || r.data?.data || r.data || []).filter(Boolean)
        setTemplates(list)
        if (list[0]) setTplId(list[0].id)
      })
      .catch(() => {})
  }, [load])

  const createInvitation = async () => {
    if (!tplId) return
    setBusy(true)
    try {
      const r = await api.ctv.createCustomerInvitation(customer.id, tplId)
      const inv = r.data?.data || r.data
      await modal.alert({
        tone: 'success',
        title: 'Đã tạo thiệp cho khách',
        message: `Đã tạo thiệp thành công cho khách "${customer.username}".\nHệ thống sẽ mở trình chỉnh sửa thiệp ngay bây giờ.`,
      })
      navigate(`/editor/${inv.id}`)
      load()
      onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi tạo thiệp', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  const copy = (txt) => {
    navigator.clipboard?.writeText(txt)
    alert('Đã copy đường dẫn thiệp!')
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1f1917' }}>
            Thiệp cưới của khách: {customer.username} ({customer.name || 'Khách hàng'})
          </div>
          <div style={{ fontSize: 12, color: '#6e625c', marginTop: 2 }}>
            Lượt khả dụng: <strong>{customer.cards_available ?? 0}</strong> lượt | Bạn có thể chọn mẫu và tạo thiệp hộ khách để bắt đầu chỉnh sửa.
          </div>
        </div>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      {/* Tạo thiệp hộ khách */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, background: '#fff', padding: '10px 14px', borderRadius: 10, border: '1px solid #ede5db' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#5c524c' }}>Chọn mẫu thiệp:</span>
        <select
          style={{ ...S.input, width: 'auto', minWidth: 220 }}
          value={tplId}
          onChange={(e) => setTplId(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.template_name || t.template_code}
            </option>
          ))}
        </select>
        <button style={S.btnMain} onClick={createInvitation} disabled={busy || locked || !tplId}>
          <IconPlus size={14} />
          <span>{busy ? 'Đang tạo...' : 'Tạo Thiệp Hộ Khách & Mở Trình Sửa'}</span>
        </button>
      </div>

      {/* Danh sách thiệp */}
      <div style={S.tableWrap}>
        <table style={{ ...S.table, background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #ede5db' }}>
          <thead>
            <tr>
              <th style={S.th}>Tiêu Đề Thiệp</th>
              <th style={S.th}>Cô Dâu &amp; Chú Rể</th>
              <th style={S.th}>Đường Dẫn (Slug)</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {(cards?.invitations || []).map((i) => (
              <tr key={i.id}>
                <td style={S.td}>
                  <strong>{i.title_vi || 'Thiệp cưới'}</strong>
                </td>
                <td style={S.td}>
                  {i.groom || 'Chú rể'} &amp; {i.bride || 'Cô dâu'}
                </td>
                <td style={S.td}>
                  <code style={S.code}>{i.slug}</code>
                </td>
                <td style={S.td}>
                  <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                    <button style={S.mini} onClick={() => navigate(`/editor/${i.id}`)}>
                      <IconEdit3 size={12} /> Sửa thiệp
                    </button>
                    <a
                      style={S.mini}
                      href={`/${i.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <IconEye size={12} /> Xem thiệp
                    </a>
                    <button style={S.mini} onClick={() => copy(`${window.location.origin}/${i.slug}`)}>
                      <IconCopy size={12} /> Copy link
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!cards?.invitations || !cards.invitations.length) && (
              <tr>
                <td colSpan={4} style={S.empty}>Khách hàng này chưa có thiệp nào. Hãy chọn mẫu ở trên để tạo thiệp ngay!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* =========================================================================
   3. INVITATIONS TAB (Quản Lý Thiệp Toàn Bộ Khách Hàng)
   ========================================================================= */
function InvitationsTab({ me, navigate, onOpenCustomers }) {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setBusy(true)
    api.ctv.listInvitations({ search, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
      .finally(() => setBusy(false))
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const copy = (txt) => {
    navigator.clipboard?.writeText(txt)
    alert('Đã copy đường dẫn thiệp!')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', width: 320 }}>
          <input
            style={{ ...S.input, width: '100%', paddingLeft: 36 }}
            placeholder="Tìm theo tiêu đề, slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9e918a', display: 'flex' }}>
            <IconSearch size={15} />
          </span>
        </div>
        <button style={S.btnMain} onClick={onOpenCustomers}>
          <IconPlus size={14} />
          <span>Tạo Thiệp Hộ Khách</span>
        </button>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Tiêu Đề Thiệp</th>
              <th style={S.th}>Đường Dẫn (Slug)</th>
              <th style={S.th}>Khách Hàng</th>
              <th style={S.th}>Mẫu Thiệp</th>
              <th style={S.th}>Trạng Thái</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={S.td}>
                  <strong>{r.title_vi || 'Thiệp cưới'}</strong>
                  <div style={{ fontSize: 11.5, color: '#6e625c' }}>
                    {r.groom?.name_groom || 'Chú rể'} &amp; {r.bride?.name_bride || 'Cô dâu'}
                  </div>
                </td>
                <td style={S.td}>
                  <code style={S.code}>{r.invitation_slug}</code>
                </td>
                <td style={S.td}>
                  <strong>{r.customer?.username || r.user?.username || '—'}</strong>
                  {r.customer?.name && <div style={{ fontSize: 11.5, color: '#6e625c' }}>{r.customer.name}</div>}
                </td>
                <td style={S.td}>
                  {r.template?.template_name || r.template?.template_code || '—'}
                </td>
                <td style={S.td}>
                  {r.lock_state?.locked ? (
                    <span style={S.pillLock}><IconLock size={12} /> Khoá sửa</span>
                  ) : (
                    <span style={S.pillOk}><IconCheckCircle size={12} /> Đang mở</span>
                  )}
                </td>
                <td style={S.td}>
                  <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                    <button style={S.mini} onClick={() => navigate(`/editor/${r.id}`)}>
                      <IconEdit3 size={12} /> Sửa thiệp
                    </button>
                    <a
                      style={S.mini}
                      href={`/${r.invitation_slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <IconEye size={12} /> Xem
                    </a>
                    <button style={S.mini} onClick={() => copy(`${window.location.origin}/${r.invitation_slug}`)}>
                      <IconCopy size={12} /> Copy link
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !busy && (
              <tr>
                <td colSpan={6} style={S.empty}>Chưa có thiệp nào thuộc quyền quản lý của bạn.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* =========================================================================
   4. TEMPLATES TAB (Kho Mẫu Thiệp)
   ========================================================================= */
function TemplatesTab({ me, navigate, onOpenCustomers }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTemplates()
      .then((r) => {
        const list = (r.data?.data?.items || r.data?.data || r.data || []).filter(Boolean)
        setTemplates(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h3 style={{ ...S.h3, margin: 0 }}>Kho Mẫu Thiệp Cưới Chuẩn Mobile 9:16</h3>
          <p style={{ ...S.tiny, marginTop: 4 }}>Duyệt các mẫu thiệp có sẵn để tư vấn cho khách hàng hoặc bấm tạo thiệp ngay.</p>
        </div>
        <button style={S.btnMain} onClick={onOpenCustomers}>
          <IconPlus size={14} />
          <span>Tạo Thiệp Cho Khách</span>
        </button>
      </div>

      {loading && <p style={S.muted}>Đang tải kho mẫu...</p>}

      <div style={S.templateGrid}>
        {templates.map((tpl) => (
          <div key={tpl.id} style={S.templateCard}>
            <div style={S.templatePreviewBox}>
              {tpl.thumbnail_url ? (
                <img src={tpl.thumbnail_url} alt={tpl.template_name} style={S.templateThumb} />
              ) : (
                <div style={S.templateThumbPlaceholder}>
                  <IconPalette size={32} color="#c9a96e" />
                </div>
              )}
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1f1917', marginBottom: 4 }}>
                {tpl.template_name || tpl.template_code}
              </div>
              <div style={{ fontSize: 11.5, color: '#6e625c', marginBottom: 12 }}>
                Thiết kế 9:16 tương thích mobile · Hộp nhạc &amp; RSVP
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <a
                  style={{ ...S.mini, flex: 1, justifyContent: 'center' }}
                  href={`/preview/${tpl.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconEye size={12} /> Xem thử
                </a>
                <button
                  style={{ ...S.btnMain, padding: '5px 12px', fontSize: 12 }}
                  onClick={onOpenCustomers}
                >
                  Tạo cho khách
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================================
   5. ORDERS TAB (Đơn Hàng)
   ========================================================================= */
function OrdersTab({ onOpenCustomer }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api.ctv.listOrders({ status: status || undefined, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [status])

  const copy = (txt) => {
    navigator.clipboard?.writeText(txt)
    alert('Đã sao chép link thanh toán!')
  }

  return (
    <div>
      <div style={S.toolbar}>
        <select style={{ ...S.input, width: 'auto', minWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ thanh toán</option>
          <option value="paid">Đã thanh toán</option>
          <option value="cancelled">Đã huỷ</option>
          <option value="expired">Hết hạn</option>
        </select>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Mã Đơn</th>
              <th style={S.th}>Khách Hàng</th>
              <th style={S.th}>Sản Phẩm</th>
              <th style={S.th}>Số Tiền</th>
              <th style={S.th}>Hoa Hồng CTV</th>
              <th style={S.th}>Trạng Thái</th>
              <th style={S.th}>Ngày Tạo</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td style={S.td}>
                  <code style={S.code}>{String(o.id).slice(0, 8)}</code>
                </td>
                <td style={S.td}>
                  <strong>{o.customer?.username || '—'}</strong>
                  {o.customer?.name && <div style={{ fontSize: 11.5, color: '#6e625c' }}>{o.customer.name}</div>}
                </td>
                <td style={S.td}>
                  {o.product_code === 'combo' ? 'Combo 2 thiệp' : '1 thiệp lẻ'}
                </td>
                <td style={S.td}>
                  <strong>{money(o.amount)}</strong>
                </td>
                <td style={S.td}>
                  <strong style={{ color: '#4f7e65' }}>{money(o.ctv_earning_amount)}</strong>
                </td>
                <td style={S.td}>
                  <Badge s={o.status} />
                </td>
                <td style={S.td}>
                  {new Date(o.created_at).toLocaleDateString('vi-VN')}
                </td>
                <td style={S.td}>
                  <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                    {o.pay_page_url && o.status !== 'paid' && (
                      <button style={S.mini} onClick={() => copy(payUrl(o.pay_page_url))}>
                        <IconCopy size={12} /> Link thanh toán
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} style={S.empty}>Không có đơn hàng nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* =========================================================================
   6. WALLET TAB (Ví & Rút Tiền)
   ========================================================================= */
function WalletTab({ me, onChanged }) {
  const modal = useModal()
  const [w, setW] = useState(null)
  const [col, setCol] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.ctv.wallet().then((r) => setW(r.data?.data || r.data)).catch(() => {})
    api.ctv.collections().then((r) => setCol(r.data?.data || r.data)).catch(() => {})
    api.ctv.listPayouts({ limit: 50 }).then((r) => setPayouts((r.data?.data || r.data).items || [])).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const requestPayout = async () => {
    const num = Number(amount)
    if (!num || num <= 0) {
      await modal.alert({ title: 'Số tiền không hợp lệ', message: 'Vui lòng nhập số tiền lớn hơn 0.' })
      return
    }
    const min = me?.payout_policy?.effective_min || 0
    if (num < min) {
      await modal.alert({ title: 'Dưới mức tối thiểu', message: `Số tiền rút tối thiểu là ${money(min)}.` })
      return
    }
    setBusy(true)
    try {
      await api.ctv.createPayout(num, note)
      await modal.alert({ tone: 'success', title: 'Đã gửi yêu cầu rút tiền', message: 'Yêu cầu của bạn đã được ghi nhận và đang chờ admin phê duyệt.' })
      setAmount('')
      setNote('')
      load()
      onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  const cancelPayout = async (p) => {
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Huỷ yêu cầu rút',
      message: `Bạn có chắc muốn huỷ phiếu rút ${money(p.amount)}?`,
    })
    if (!ok) return
    try {
      await api.ctv.cancelPayout(p.id)
      load()
      onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  return (
    <div>
      <div style={S.walletBox}>
        <h3 style={{ ...S.h3, margin: '0 0 14px' }}>Số Dư Ví CTV</h3>
        <div style={S.walletRow}>
          <WBlock label="Số dư khả dụng" val={money(w?.wallet?.balance)} strong color="#c96547" />
          <WBlock label="Đang chờ duyệt" val={money(w?.wallet?.pending_balance)} />
          <WBlock label="Tổng hoa hồng đã nhận" val={money(w?.wallet?.total_earned)} />
          <WBlock label="Tổng tiền đã chi trả" val={money(w?.wallet?.total_paid)} />
        </div>
      </div>

      {col && (
        <div style={S.panel}>
          <h3 style={S.h3}>Sổ Thu Hộ Nền Tảng</h3>
          <div style={S.walletRow}>
            <WBlock label="Tổng tiền khách đã thanh toán" val={money(col.total_collected)} />
            <WBlock label="Số đơn đã hoàn tất" val={col.paid_orders_count || 0} />
            <WBlock label="Hoa hồng được hưởng" val={money(col.total_commission)} color="#4f7e65" />
          </div>
        </div>
      )}

      {/* Tạo phiếu rút */}
      <div style={S.panel}>
        <h3 style={S.h3}>Tạo Yêu Cầu Rút Tiền</h3>
        <div style={{ ...S.formGrid, maxWidth: 600 }}>
          <Field label={`Số tiền muốn rút (Tối thiểu ${money(me?.payout_policy?.effective_min || 0)})`}>
            <input
              style={S.input}
              type="number"
              placeholder="VD: 500000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Ghi chú (tuỳ chọn)">
            <input
              style={S.input}
              placeholder="Ghi chú kèm theo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <button style={S.btnMain} onClick={requestPayout} disabled={busy || me?.profile?.status === 'locked'}>
            <IconCreditCard size={14} />
            <span>{busy ? 'Đang gửi...' : 'Gửi Yêu Cầu Rút Tiền'}</span>
          </button>
        </div>
      </div>

      {/* Danh sách phiếu rút */}
      <div style={S.panel}>
        <h3 style={S.h3}>Lịch Sử Phiếu Rút Tiền</h3>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Số Tiền</th>
                <th style={S.th}>Trạng Thái</th>
                <th style={S.th}>Ghi Chú</th>
                <th style={S.th}>Ngày Tạo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td style={S.td}>
                    <strong>{money(p.amount)}</strong>
                  </td>
                  <td style={S.td}>
                    <Badge s={p.status} />
                  </td>
                  <td style={S.td}>{p.note || '—'}</td>
                  <td style={S.td}>{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
                  <td style={S.td}>
                    <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                      {p.status === 'pending' && (
                        <button style={{ ...S.mini, color: '#c04938' }} onClick={() => cancelPayout(p)}>
                          <IconX size={12} /> Huỷ phiếu
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!payouts.length && (
                <tr>
                  <td colSpan={5} style={S.empty}>Chưa có phiếu rút tiền nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   7. SETTINGS TAB (Cấu Hình)
   ========================================================================= */
function SettingsTab({ me, onSaved }) {
  const modal = useModal()
  const p = me?.profile || {}
  const [f, setF] = useState({
    bank_name: p.bank_name || '',
    bank_account_number: p.bank_account_number || '',
    bank_account_name: p.bank_account_name || '',
    auto_payout_enabled: Boolean(p.auto_payout_enabled),
    auto_payout_weekday: p.auto_payout_weekday == null ? '' : p.auto_payout_weekday,
    auto_payout_min_amount: p.auto_payout_min_amount || 200000,
  })
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await api.ctv.updatePayoutSettings({
        bank_name: f.bank_name,
        bank_account_number: f.bank_account_number,
        bank_account_name: f.bank_account_name,
        auto_payout_enabled: f.auto_payout_enabled,
        auto_payout_weekday: f.auto_payout_weekday === '' ? null : Number(f.auto_payout_weekday),
        auto_payout_min_amount: Number(f.auto_payout_min_amount) || 0,
      })
      await modal.alert({ tone: 'success', title: 'Đã lưu', message: 'Thông tin cấu hình rút tiền đã được cập nhật thành công.' })
      onSaved?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={S.panel}>
        <h3 style={S.h3}>Chính Sách &amp; Bảng Giá CTV Của Bạn</h3>
        <div style={S.walletRow}>
          <WBlock label="Giá bán 1 thiệp" val={money(p.single_price)} />
          <WBlock label="Giá bán Combo 2 thiệp" val={money(p.combo_price)} />
          <WBlock label="Tỷ lệ hoa hồng CTV" val={pct(p.commission_rate)} color="#4f7e65" strong />
        </div>
        <p style={{ ...S.tiny, marginTop: 10 }}>Bảng giá và tỷ lệ hoa hồng do quản trị viên thiết lập. Hãy liên hệ admin nếu cần điều chỉnh.</p>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Tài Khoản Ngân Hàng Nhận Tiền</h3>
        <div style={S.formGrid}>
          <Field label="Tên ngân hàng">
            <input style={S.input} placeholder="VD: Vietcombank, MB Bank..." value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} />
          </Field>
          <Field label="Số tài khoản">
            <input style={S.input} placeholder="Số tài khoản ngân hàng" value={f.bank_account_number} onChange={(e) => setF({ ...f, bank_account_number: e.target.value })} />
          </Field>
          <Field label="Tên chủ tài khoản">
            <input style={S.input} placeholder="NGUYEN VAN A" value={f.bank_account_name} onChange={(e) => setF({ ...f, bank_account_name: e.target.value })} />
          </Field>
        </div>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Cấu Hình Rút Tiền Tự Động</h3>
        <label style={S.radio}>
          <input type="checkbox" checked={f.auto_payout_enabled} onChange={(e) => setF({ ...f, auto_payout_enabled: e.target.checked })} />
          <span>Bật tạo phiếu rút tiền tự động hằng tuần</span>
        </label>
        <div style={{ ...S.formGrid, marginTop: 12 }}>
          <Field label="Ngày trong tuần">
            <select style={S.input} value={f.auto_payout_weekday} onChange={(e) => setF({ ...f, auto_payout_weekday: e.target.value })}>
              <option value="">Theo mặc định hệ thống</option>
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={i}>{w}</option>
              ))}
            </select>
          </Field>
          <Field label="Ngưỡng tối thiểu (₫)">
            <input
              style={S.input}
              type="number"
              value={f.auto_payout_min_amount}
              onChange={(e) => setF({ ...f, auto_payout_min_amount: e.target.value })}
            />
          </Field>
        </div>
        <p style={{ ...S.tiny, marginTop: 10 }}>Hằng tuần vào ngày đã chọn, nếu số dư khả dụng ≥ ngưỡng tối thiểu, hệ thống sẽ tự động tạo phiếu rút tiền.</p>
      </div>

      <button style={S.btnMain} disabled={busy} onClick={save}>
        <span>{busy ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
      </button>
    </div>
  )
}

/* =========================================================================
   UI HELPERS & BADGES
   ========================================================================= */
const Field = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 200px' }}>
    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#5c524c' }}>{label}</span>
    {children}
  </label>
)

const Badge = ({ s }) => {
  const map = {
    paid: ['#4f7e65', 'rgba(79,126,101,.12)'],
    active: ['#4f7e65', 'rgba(79,126,101,.12)'],
    approved: ['#4f7e65', 'rgba(79,126,101,.12)'],
    pending: ['#c9902f', 'rgba(201,144,47,.14)'],
    pending_payment: ['#c9902f', 'rgba(201,144,47,.14)'],
    expired: ['#8a7f78', 'rgba(138,127,120,.14)'],
    cancelled: ['#c04938', 'rgba(192,73,56,.1)'],
    rejected: ['#c04938', 'rgba(192,73,56,.1)'],
    refunded: ['#c04938', 'rgba(192,73,56,.1)'],
    locked: ['#c04938', 'rgba(192,73,56,.1)'],
  }
  const [c, bg] = map[s] || ['#6e625c', '#f0eae2']
  return (
    <span style={{ color: c, background: bg, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600 }}>
      {STATUS_VI[s] || s}
    </span>
  )
}

/* =========================================================================
   STYLES (Clean, modern sans-serif admin system)
   ========================================================================= */
const S = {
  page: {
    minHeight: '100vh',
    background: '#fcfaf7',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#1f1917',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 36px',
    borderBottom: '1px solid #ede5db',
    background: '#fff',
    boxShadow: '0 2px 8px rgba(31,25,23,0.03)',
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #d97757 0%, #c96547 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(217,119,87,0.3)',
    flexShrink: 0,
  },
  brand: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1f1917',
  },
  sub: {
    fontSize: 12,
    color: '#6e625c',
    marginTop: 2,
  },
  tabs: {
    display: 'flex',
    gap: 6,
    padding: '0 36px',
    borderBottom: '1px solid #ede5db',
    background: '#fff',
    overflowX: 'auto',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 18px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 500,
    color: '#6e625c',
    borderBottom: '2.5px solid transparent',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  tabOn: {
    color: '#d97757',
    borderBottomColor: '#d97757',
    fontWeight: 600,
  },
  body: {
    padding: '32px 36px 64px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    padding: 20,
  },
  centerCard: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 20,
    padding: '40px 32px',
    boxShadow: '0 10px 30px rgba(31,25,23,0.06)',
    maxWidth: 420,
  },
  lockedBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(192,73,56,.08)',
    color: '#c04938',
    padding: '12px 36px',
    fontSize: 13.5,
    fontWeight: 500,
    borderBottom: '1px solid rgba(192,73,56,.2)',
  },
  h3: {
    fontSize: 18,
    fontWeight: 700,
    margin: '28px 0 14px',
    color: '#1f1917',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  stat: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '20px 22px',
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
  },
  statVal: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.1,
    marginTop: 4,
  },
  statKey: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6e625c',
  },
  walletBox: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '22px 24px',
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
    marginBottom: 20,
  },
  walletRow: {
    display: 'flex',
    gap: 28,
    flexWrap: 'wrap',
  },
  wBlock: {
    minWidth: 130,
  },
  wVal: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1f1917',
  },
  panel: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '22px 24px',
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
    marginBottom: 20,
  },
  formGrid: {
    display: 'flex',
    gap: 14,
    flexWrap: 'wrap',
  },
  createBox: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '20px 22px',
    marginBottom: 18,
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
  },
  createTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 700,
    color: '#1f1917',
    marginBottom: 12,
  },
  createRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  input: {
    padding: '9px 13px',
    borderRadius: 10,
    border: '1px solid #ede5db',
    background: '#fff',
    fontSize: 13.5,
    fontFamily: 'inherit',
    color: '#1f1917',
    outline: 'none',
  },
  radio: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13.5,
    fontWeight: 500,
    cursor: 'pointer',
  },
  tableWrap: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: 13,
  },
  th: {
    background: '#fcfaf7',
    padding: '12px 16px',
    fontSize: 11.5,
    fontWeight: 700,
    color: '#6e625c',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #ede5db',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid #f6f1eb',
    verticalAlign: 'middle',
  },
  acts: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  btnMain: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 18px',
    background: 'linear-gradient(135deg, #d97757 0%, #c96547 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(217,119,87,0.25)',
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: '#fcfaf7',
    color: '#6e625c',
    border: '1px solid #ede5db',
    borderRadius: 9999,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  mini: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    background: '#fcfaf7',
    color: '#5c524c',
    border: '1px solid #ede5db',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  miniActive: {
    background: '#d97757',
    color: '#fff',
    borderColor: '#d97757',
  },
  pillOk: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(79,126,101,0.12)',
    color: '#4f7e65',
    fontSize: 11.5,
    fontWeight: 600,
  },
  pillLock: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(192,73,56,0.1)',
    color: '#c04938',
    fontSize: 11.5,
    fontWeight: 600,
  },
  code: {
    fontFamily: "'Courier New', monospace",
    fontSize: 12,
    background: '#f6f1eb',
    padding: '2px 6px',
    borderRadius: 6,
    color: '#5c524c',
  },
  tiny: {
    fontSize: 12,
    color: '#9e918a',
    lineHeight: 1.5,
  },
  muted: {
    fontSize: 13.5,
    color: '#6e625c',
  },
  empty: {
    padding: 36,
    textAlign: 'center',
    color: '#9e918a',
    fontSize: 13.5,
  },
  err: {
    background: 'rgba(192,73,56,0.08)',
    border: '1px solid rgba(192,73,56,0.2)',
    color: '#c04938',
    padding: '12px 16px',
    borderRadius: 12,
    fontSize: 13.5,
    marginBottom: 16,
  },
  toolbar: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 18,
  },
  templateCard: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
  },
  templatePreviewBox: {
    width: '100%',
    height: 320,
    background: '#f6f1eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  templateThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  templateThumbPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #fcfaf7 0%, #ede5db 100%)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(31,25,23,0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalBox: {
    background: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 20px 50px rgba(31,25,23,0.2)',
  },
  qrCard: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: 16,
    background: '#faf6f0',
    borderRadius: 14,
    border: '1px solid #ede5db',
  },
  qr: {
    borderRadius: 10,
    border: '1px solid #ede5db',
    background: '#fff',
  },
}

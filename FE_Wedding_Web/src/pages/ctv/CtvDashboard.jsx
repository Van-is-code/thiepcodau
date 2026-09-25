import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useModal } from '../../components/Modal'
import {
  IconSparkles,
  IconUsers,
  IconMail,
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
  IconKey,
  IconTrash2,
  IconLock,
  IconUnlock,
  IconCheckSquare,
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
  { id: 'orders', label: 'Đơn Hàng & Kích Hoạt', Icon: IconCreditCard },
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
    api.ctv.me().then((r) => setMe(r.data?.data || r.data)).catch(() => {})
  }, [])
  useEffect(() => { if (role === 'ctv') reloadMe() }, [role, reloadMe])

  if (role === null) {
    return (
      <div style={S.center}>
        <div style={S.centerCard}>
          <IconSparkles size={32} color="#d97757" />
          <p style={{ marginTop: 12, fontSize: 14, color: '#5c524c' }}>Đang xác thực tài khoản cộng tác viên...</p>
        </div>
      </div>
    )
  }

  if (role !== 'ctv') {
    return (
      <div style={S.center}>
        <div style={{ ...S.centerCard, borderColor: 'rgba(192,73,56,0.3)' }}>
          <p style={{ color: '#c04938', fontWeight: 600, marginBottom: 14, fontSize: 15 }}>
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
              Thiệp lẻ {money(me?.profile?.single_price)} · Combo {money(me?.profile?.combo_price)} · Hoa hồng {pct(me?.profile?.commission_rate)} · Cấp tài khoản &amp; tạo thiệp hộ khách
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
          <IconAlertCircle size={16} /> Tài khoản CTV của bạn đang bị khoá. Bạn không thể tạo khách / tạo đơn / rút tiền. Liên hệ quản trị viên.
        </div>
      )}

      <nav style={S.tabs}>
        {TABS.map((t) => {
          const TabIcon = t.Icon
          const isOn = tab === t.id
          return (
            <button key={t.id} style={{ ...S.tab, ...(isOn ? S.tabOn : {}) }} onClick={() => setTab(t.id)}>
              <TabIcon size={16} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      <div style={S.body}>
        {tab === 'overview' && <Overview me={me} onGoTab={setTab} />}
        {tab === 'customers' && <CustomersTab me={me} navigate={navigate} onChanged={reloadMe} />}
        {tab === 'invitations' && <InvitationsTab navigate={navigate} />}
        {tab === 'orders' && <OrdersTab onOpenCustomer={() => setTab('customers')} />}
        {tab === 'wallet' && <WalletTab me={me} onChanged={reloadMe} />}
        {tab === 'settings' && <SettingsTab me={me} onSaved={reloadMe} />}
      </div>
    </div>
  )
}

/* ------------------------- Tổng quan ------------------------- */
function Overview({ me, onGoTab }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.ctv.dashboard()
      .then((r) => setD(r.data?.data || r.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [])

  if (err) return <div style={S.err}>⚠️ {err}</div>
  if (!d) return <p style={S.muted}>Đang tải số liệu...</p>

  const cards = [
    { label: 'Doanh thu tháng này', val: money(d.month.revenue), c: '#d97757' },
    { label: 'Hoa hồng tháng này', val: money(d.month.commission_earning), c: '#4f7e65' },
    { label: 'Đơn đã thanh toán (tháng)', val: d.month.paid_orders, c: '#c9a96e' },
    { label: 'Khách hàng', val: `${d.customers.active}/${d.customers.total}`, sub: 'đang hoạt động / tổng', c: '#7a6f68' },
    { label: 'Đơn chờ thanh toán', val: d.orders.pending, c: '#c9902f' },
  ]

  return (
    <div>
      <div style={S.statGrid}>
        {cards.map((c) => (
          <div key={c.label} style={S.stat}>
            <div style={{ ...S.statDot, background: c.c }} />
            <div style={S.statVal}>{c.val}</div>
            <div style={S.statKey}>{c.label}</div>
            {c.sub && <div style={S.tiny}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div style={S.walletBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>Ví hoa hồng của bạn</h3>
          <button style={S.mini} onClick={() => onGoTab('wallet')}>
            <IconCreditCard size={13} /> Rút tiền ngay
          </button>
        </div>
        <div style={S.walletRow}>
          <WBlock label="Số dư khả dụng" val={money(d.wallet.balance)} strong />
          <WBlock label="Đang chờ rút" val={money(d.wallet.pending_balance)} />
          <WBlock label="Tổng đã nhận" val={money(d.wallet.total_earned)} />
          <WBlock label="Đã được chi trả" val={money(d.wallet.total_paid)} />
        </div>
        {!d.wallet.ledger_consistent && (
          <p style={{ ...S.tiny, color: '#c04938', marginTop: 10 }}>⚠ Số dư lệch sổ cái — liên hệ quản trị viên.</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button style={S.btnMain} onClick={() => onGoTab('customers')}>
          <IconUsers size={14} /> Cấp tài khoản &amp; tạo thiệp hộ khách
        </button>
        <button style={S.btnGhost} onClick={() => onGoTab('invitations')}>
          <IconMail size={14} /> Danh sách thiệp đã tạo
        </button>
      </div>
    </div>
  )
}

const WBlock = ({ label, val, strong }) => (
  <div style={S.wBlock}>
    <div style={{ ...S.wVal, ...(strong ? { color: '#c96547', fontSize: 22, fontWeight: 700 } : {}) }}>{val}</div>
    <div style={S.tiny}>{label}</div>
  </div>
)

/* ------------------------- Tài khoản khách ------------------------- */
function CustomersTab({ me, navigate, onChanged }) {
  const modal = useModal()
  const locked = me?.profile?.status === 'locked'
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState('')

  // Form tạo tài khoản khách
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    phone: '',
    email: '',
    cards: 1,
  })

  // State mở popup tạo đơn payOS cho khách
  const [orderModalCust, setOrderModalCust] = useState(null)

  const load = useCallback(() => {
    api.ctv.listCustomers({ search, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [search])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      await modal.alert({ tone: 'warn', title: 'Thiếu thông tin', message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' })
      return
    }
    setBusy(true)
    try {
      const r = await api.ctv.createCustomer(form)
      const c = r.data?.data || r.data
      setForm({ username: '', password: '', name: '', phone: '', email: '', cards: 1 })
      load()
      onChanged?.()
      await modal.alert({
        tone: 'success',
        title: 'Đã tạo tài khoản khách',
        message: `Thông tin bàn giao cho khách:\n\n• Tên đăng nhập: ${c.username}\n• Mật khẩu: ${c.password}\n• Số lượt tạo thiệp ban đầu: ${c.cards_available || form.cards}\n\nBạn có thể bấm "Quản lý thiệp" tại dòng của khách để chọn mẫu và tạo thiệp hộ ngay!`,
      })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  const addSlots = async (c) => {
    const ok = await modal.confirm({
      title: 'Cấp thêm lượt tạo thiệp',
      message: `Cộng thêm 1 lượt tạo thiệp cho tài khoản khách "${c.username}" (hiện đang có ${c.cards_available} lượt)?`,
      confirmText: '+1 lượt ngay',
    })
    if (!ok) return
    try {
      await api.ctv.updateCustomer(c.id, { cards_available: (c.cards_available || 0) + 1 })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const setSlots = async (c) => {
    const v = window.prompt(`Nhập số lượt tạo thiệp khả dụng mới cho "${c.username}":`, String(c.cards_available || 0))
    if (v == null || v.trim() === '') return
    try {
      await api.ctv.updateCustomer(c.id, { cards_available: Number(v) })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const resetPw = async (c) => {
    const v = window.prompt(`Nhập mật khẩu mới cho tài khoản "${c.username}":`, '')
    if (!v) return
    try {
      await api.ctv.updateCustomer(c.id, { password: v })
      await modal.alert({ tone: 'success', title: 'Thành công', message: 'Đã đổi mật khẩu tài khoản khách.' })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const del = async (c) => {
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Xoá tài khoản khách',
      message: `Bạn có chắc muốn xoá tài khoản khách "${c.username}"? Toàn bộ thiệp và dữ liệu liên quan sẽ bị xoá.`,
      confirmText: 'Xoá Tài Khoản',
    })
    if (!ok) return
    try {
      await api.ctv.deleteCustomer(c.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  return (
    <div>
      {/* Create User Box (y hệt Admin) */}
      <div style={S.createBox}>
        <div style={S.createTitle}>
          <IconPlus size={16} color="#d97757" />
          <span>Cấp Mới Tài Khoản Khách</span>
        </div>
        <div style={S.createRow}>
          <input
            style={S.input}
            placeholder="Tên đăng nhập (username) *"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            disabled={locked}
          />
          <input
            style={S.input}
            placeholder="Mật khẩu * (≥ 6 ký tự)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            disabled={locked}
          />
          <input
            style={S.input}
            placeholder="Họ tên khách (tuỳ chọn)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={locked}
          />
          <input
            style={{ ...S.input, width: 140 }}
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            disabled={locked}
          />
          <input
            style={{ ...S.input, width: 110 }}
            type="number"
            min="0"
            placeholder="Số thiệp"
            value={form.cards}
            onChange={(e) => setForm({ ...form, cards: Number(e.target.value) })}
            disabled={locked}
          />
          <button style={S.btnMain} onClick={create} disabled={busy || locked || !form.username || !form.password}>
            <IconPlus size={14} />
            <span>{busy ? 'Đang tạo...' : 'Tạo Tài Khoản'}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', width: 320, margin: '6px 0 14px' }}>
        <input
          style={{ ...S.input, width: '100%', paddingLeft: 36 }}
          placeholder="Tìm theo username, tên, SĐT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9e918a', display: 'flex' }}>
          <IconSearch size={15} />
        </span>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Tên Đăng Nhập / Khách</th>
              <th style={S.th}>Số Điện Thoại</th>
              <th style={S.th}>Trạng Thái</th>
              <th style={S.th}>Lượt Tạo Thiệp</th>
              <th style={S.th}>Số Thiệp</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <React.Fragment key={c.id}>
                <tr>
                  <td style={S.td}>
                    <strong>{c.username}</strong>
                    {c.name && <div style={S.tiny}>{c.name}</div>}
                  </td>
                  <td style={S.td}>{c.phone || '—'}</td>
                  <td style={S.td}><Badge s={c.status} /></td>
                  <td style={S.td}>
                    <strong style={{ color: '#d97757', fontSize: 14 }}>{c.cards_available}</strong>
                    <span style={S.tiny}> / {c.cards_purchased} (đã dùng {c.cards_used})</span>
                  </td>
                  <td style={S.td}>{c.invitation_count ?? 0} thiệp</td>
                  <td style={S.td}>
                    <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                      <button
                        style={{ ...S.mini, ...(expandedId === c.id ? S.miniActive : {}) }}
                        onClick={() => setExpandedId((v) => (v === c.id ? '' : c.id))}
                      >
                        <IconMail size={12} /> {expandedId === c.id ? 'Đóng' : 'Quản lý thiệp'}
                      </button>
                      <button style={S.mini} onClick={() => addSlots(c)}>+1 lượt</button>
                      <button style={S.mini} onClick={() => setSlots(c)}>Đặt lượt</button>
                      <button style={S.mini} onClick={() => setOrderModalCust(c)}>
                        <IconQrCode size={12} /> Tạo đơn payOS
                      </button>
                      <button style={S.mini} onClick={() => resetPw(c)}>
                        <IconKey size={12} /> Mật khẩu
                      </button>
                      <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => del(c)}>
                        <IconTrash2 size={12} /> Xoá
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === c.id && (
                  <tr>
                    <td colSpan={6} style={{ ...S.td, background: '#faf6f0', padding: 0 }}>
                      <CtvCustomerPanel customer={c} navigate={navigate} modal={modal} onChanged={load} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} style={S.empty}>
                  Chưa có tài khoản khách nào. Hãy nhập thông tin phía trên để cấp tài khoản mới.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {orderModalCust && (
        <CtvOrderModal
          customer={orderModalCust}
          me={me}
          onClose={() => setOrderModalCust(null)}
          onChanged={() => { load(); onChanged?.() }}
        />
      )}
    </div>
  )
}

/* -------- CtvCustomerPanel: quản lý thiệp + tạo thiệp HỘ 1 khách -------- */
function CtvCustomerPanel({ customer, navigate, modal, onChanged }) {
  const [cards, setCards] = useState(null)
  const [templates, setTemplates] = useState([])
  const [tplId, setTplId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.ctv.customerCards(customer.id)
      .then((r) => setCards(r.data?.data || r.data))
      .catch(() => {})
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
        message: `Đã tạo thiệp mới thành công cho tài khoản "${customer.username}".\nBạn sẽ được chuyển vào trình sửa thiệp ngay bây giờ.`,
        confirmText: 'Mở trình sửa',
      })
      navigate(`/editor/${inv.id}`)
      load()
      onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  const del = async (inv) => {
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Xoá thiệp',
      confirmText: 'Xoá',
      message: `Xoá thiệp "${inv.title_vi}" của khách "${customer.username}"?`,
    })
    if (!ok) return
    try {
      await api.deleteInvitation(inv.id)
      load()
      onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const toggleLock = async (inv) => {
    const st = inv.lock_state || {}
    try {
      if (st.locked) await api.ctv.unlockInvitation(inv.id)
      else await api.ctv.lockInvitation(inv.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1f1917', marginBottom: 4 }}>
        Thiệp &amp; dữ liệu của khách: {customer.username}
      </div>
      <div style={{ fontSize: 12, color: '#6e625c', marginBottom: 14 }}>
        Bạn có thể chọn mẫu thiệp để tạo hộ khách, hoặc vào chỉnh sửa trực tiếp thông tin đám cưới cho khách.
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select style={{ ...S.input, minWidth: 240 }} value={tplId} onChange={(e) => setTplId(e.target.value)}>
          {templates.length === 0 && <option value="">(chưa có mẫu)</option>}
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.template_name || t.template_code}</option>
          ))}
        </select>
        <button style={S.btnMain} onClick={createInvitation} disabled={busy || !tplId}>
          <IconPlus size={14} />
          <span>{busy ? 'Đang tạo...' : 'Tạo thiệp cho khách này'}</span>
        </button>
      </div>

      <div style={{ ...S.tableWrap, background: '#fff' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Tên Thiệp / Slug</th>
              <th style={S.th}>Mẫu Thiệp</th>
              <th style={S.th}>Chú Rể &amp; Cô Dâu</th>
              <th style={S.th}>Trạng Thái Khoá</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {(cards?.invitations || []).map((inv) => {
              const st = inv.lock_state || {}
              return (
                <tr key={inv.id}>
                  <td style={S.td}>
                    <strong>{inv.title_vi || 'Thiệp cưới'}</strong>
                    {inv.slug && (
                      <div style={S.tiny}>
                        <a href={`/thiep/${inv.slug}`} target="_blank" rel="noreferrer" style={{ color: '#d97757' }}>
                          /thiep/{inv.slug} <IconExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </td>
                  <td style={S.td}>{inv.template?.template_name || inv.template?.template_code || '—'}</td>
                  <td style={S.td}>
                    {inv.groom?.name_groom || 'Chú rể'} &amp; {inv.bride?.name_bride || 'Cô dâu'}
                  </td>
                  <td style={S.td}>
                    {st.locked ? (
                      <span style={S.pillLock}><IconLock size={12} /> Đã khoá</span>
                    ) : (
                      <span style={S.pillOk}><IconUnlock size={12} /> Mở sửa</span>
                    )}
                  </td>
                  <td style={S.td}>
                    <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                      <button style={S.mini} onClick={() => navigate(`/editor/${inv.id}`)}>
                        <IconEdit3 size={12} /> Sửa thiệp
                      </button>
                      {inv.slug && (
                        <a style={S.mini} href={`/thiep/${inv.slug}`} target="_blank" rel="noreferrer">
                          <IconExternalLink size={12} /> Xem
                        </a>
                      )}
                      <button style={S.mini} onClick={() => toggleLock(inv)}>
                        {st.locked ? 'Mở khoá' : 'Khoá sửa'}
                      </button>
                      <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => del(inv)}>
                        <IconTrash2 size={12} /> Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!(cards?.invitations || []).length && (
              <tr>
                <td colSpan={5} style={S.empty}>
                  Khách này chưa có thiệp nào. Hãy chọn mẫu ở trên và bấm "Tạo thiệp cho khách này".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------- Quản lý thiệp toàn hệ CTV ------------------------- */
function InvitationsTab({ navigate }) {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.ctv.listInvitations({ search, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [search])

  useEffect(() => { load() }, [load])

  const del = async (inv) => {
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Xoá thiệp',
      confirmText: 'Xoá Thiệp',
      message: `Bạn có chắc muốn xoá vĩnh viễn thiệp "${inv.title_vi}"? Hành động này không thể hoàn tác.`,
    })
    if (!ok) return
    try {
      await api.deleteInvitation(inv.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const toggleLock = async (inv) => {
    const st = inv.lock_state || {}
    try {
      if (st.locked) await api.ctv.unlockInvitation(inv.id)
      else await api.ctv.lockInvitation(inv.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  return (
    <div>
      <div style={{ position: 'relative', width: 320, marginBottom: 14 }}>
        <input
          style={{ ...S.input, width: '100%', paddingLeft: 36 }}
          placeholder="Tìm theo tên thiệp, slug, cô dâu, chú rể..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9e918a', display: 'flex' }}>
          <IconSearch size={15} />
        </span>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Tên Thiệp / Slug</th>
              <th style={S.th}>Khách Hàng Sở Hữu</th>
              <th style={S.th}>Chú Rể &amp; Cô Dâu</th>
              <th style={S.th}>Mẫu Thiệp</th>
              <th style={S.th}>Trạng Thái Khoá</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const st = inv.lock_state || {}
              return (
                <tr key={inv.id}>
                  <td style={S.td}>
                    <strong>{inv.title_vi || 'Thiệp cưới'}</strong>
                    {inv.invitation_slug && (
                      <div style={S.tiny}>
                        <a href={`/thiep/${inv.invitation_slug}`} target="_blank" rel="noreferrer" style={{ color: '#d97757' }}>
                          /thiep/{inv.invitation_slug} <IconExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </td>
                  <td style={S.td}>
                    <b>{inv.customer?.name || inv.customer?.phone || 'Khách hàng'}</b>
                    {inv.customer?.phone && <div style={S.tiny}>{inv.customer.phone}</div>}
                  </td>
                  <td style={S.td}>
                    {inv.groom?.name_groom || '—'} &amp; {inv.bride?.name_bride || '—'}
                  </td>
                  <td style={S.td}>{inv.template?.template_name || inv.template?.template_code || '—'}</td>
                  <td style={S.td}>
                    {st.locked ? (
                      <span style={S.pillLock}><IconLock size={12} /> Đã khoá</span>
                    ) : (
                      <span style={S.pillOk}><IconUnlock size={12} /> Mở sửa</span>
                    )}
                  </td>
                  <td style={S.td}>
                    <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                      <button style={S.mini} onClick={() => navigate(`/editor/${inv.id}`)}>
                        <IconEdit3 size={12} /> Sửa thiệp
                      </button>
                      {inv.invitation_slug && (
                        <a style={S.mini} href={`/thiep/${inv.invitation_slug}`} target="_blank" rel="noreferrer">
                          <IconExternalLink size={12} /> Xem
                        </a>
                      )}
                      <button style={S.mini} onClick={() => toggleLock(inv)}>
                        {st.locked ? 'Mở khoá' : 'Khoá'}
                      </button>
                      <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => del(inv)}>
                        <IconTrash2 size={12} /> Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} style={S.empty}>
                  Chưa có thiệp cưới nào. Bạn có thể vào tab "Tài Khoản Khách" để tạo thiệp mới cho khách.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* -------- CtvOrderModal: Popup tạo đơn payOS cho khách -------- */
function CtvOrderModal({ customer, me, onClose, onChanged }) {
  const modal = useModal()
  const [product, setProduct] = useState('single')
  const [newOrder, setNewOrder] = useState(null)
  const [busy, setBusy] = useState(false)

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
      const r = await api.ctv.createOrder(customer.id, product)
      setNewOrder(r.data?.data || r.data)
      onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  const copy = (txt) => {
    navigator.clipboard?.writeText(txt)
    alert('Đã sao chép liên kết thanh toán!')
  }

  return (
    <div style={S.modalOverlay}>
      <div style={S.modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>Tạo đơn thanh toán cho: {customer.name || customer.username}</h3>
          <button style={S.mini} onClick={onClose}>Đóng</button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <label style={S.radio}>
            <input type="radio" name="p" checked={product === 'single'} onChange={() => setProduct('single')} /> 1 thiệp — {money(priceOf('single'))}
          </label>
          <label style={S.radio}>
            <input type="radio" name="p" checked={product === 'combo'} onChange={() => setProduct('combo')} /> Combo 2 thiệp — {money(priceOf('combo'))}
          </label>
        </div>

        <div style={{ ...S.walletRow, marginBottom: 14 }}>
          <WBlock label="Khách phải trả" val={money(preview.sell)} strong />
          <WBlock label="Hoa hồng nền tảng" val={money(preview.commission)} />
          <WBlock label="CTV nhận được" val={money(preview.earn)} />
        </div>

        {!newOrder ? (
          <button style={S.btnMain} disabled={busy} onClick={createOrder}>
            <IconQrCode size={14} />
            <span>{busy ? 'Đang tạo...' : 'Tạo Đơn & Mã QR Thanh Toán'}</span>
          </button>
        ) : (
          <div style={S.qrCard}>
            <img
              alt="QR"
              width={160}
              height={160}
              style={S.qr}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(newOrder.checkout?.qr || newOrder.checkout?.checkoutUrl || '')}`}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={S.tiny}>Số tiền thanh toán</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#c96547', margin: '4px 0 10px' }}>
                {money(newOrder.order?.amount)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a style={S.mini} href={newOrder.checkout?.checkoutUrl} target="_blank" rel="noreferrer">
                  <IconExternalLink size={12} /> Mở payOS
                </a>
                <button style={S.mini} onClick={() => copy(payUrl(newOrder.pay_page_url))}>
                  <IconCopy size={12} /> Copy link cho khách
                </button>
              </div>
              <p style={{ ...S.tiny, marginTop: 8, wordBreak: 'break-all' }}>{payUrl(newOrder.pay_page_url)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------- Đơn hàng ------------------------- */
function OrdersTab({ onOpenCustomer }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api.ctv.listOrders({ status: status || undefined, limit: 100 })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [status])

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <select style={{ ...S.input, minWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái đơn</option>
          {['pending', 'paid', 'cancelled', 'expired', 'refunded'].map((s) => (
            <option key={s} value={s}>{STATUS_VI[s]}</option>
          ))}
        </select>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Khách Hàng</th>
              <th style={S.th}>Sản Phẩm</th>
              <th style={S.th}>Giá Bán</th>
              <th style={S.th}>HH Nền Tảng</th>
              <th style={S.th}>CTV Nhận</th>
              <th style={S.th}>Trạng Thái</th>
              <th style={S.th}>Ngày Tạo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td style={S.td}>
                  <b>{o.customer?.name || o.customer?.phone || 'Khách hàng'}</b>
                </td>
                <td style={S.td}>{o.product_code === 'combo' ? 'Combo 2 thiệp' : '1 thiệp'}</td>
                <td style={S.td}>{money(o.ctv_selling_price)}</td>
                <td style={S.td}>{money(o.commission_amount)}</td>
                <td style={S.td}><b>{money(o.ctv_earning_amount)}</b></td>
                <td style={S.td}><Badge s={o.status} /></td>
                <td style={S.td}>{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} style={S.empty}>Chưa có đơn hàng nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
    api.ctv.wallet({ limit: 50 })
      .then((r) => setW(r.data?.data || r.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
    api.ctv.listPayouts({ limit: 50 })
      .then((r) => setPayouts((r.data?.data || r.data).items || []))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    const v = Number(amount)
    if (!v || v <= 0) return
    setBusy(true)
    try {
      await api.ctv.createPayout(v, note)
      setAmount('')
      setNote('')
      load()
      onChanged?.()
      await modal.alert({
        tone: 'success',
        title: 'Đã gửi yêu cầu rút tiền',
        message: 'Quản trị viên sẽ duyệt và chuyển khoản theo số tài khoản ngân hàng của bạn.',
      })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id) => {
    const ok = await modal.confirm({
      tone: 'warn',
      title: 'Huỷ phiếu rút tiền?',
      message: 'Số tiền sẽ được hoàn lại vào số dư khả dụng của bạn.',
    })
    if (!ok) return
    try {
      await api.ctv.cancelPayout(id)
      load()
      onChanged?.()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  if (err) return <div style={S.err}>⚠️ {err}</div>
  if (!w) return <p style={S.muted}>Đang tải thông tin ví...</p>
  const s = w.summary

  return (
    <div>
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
          <div>
            <div style={S.label}>Số tiền muốn rút (₫)</div>
            <input
              style={S.input}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Tối đa ${money(s.balance)}`}
            />
          </div>
          <div>
            <div style={S.label}>Ghi chú (tuỳ chọn)</div>
            <input style={{ ...S.input, minWidth: 260 }} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button style={S.btnMain} disabled={busy || locked || !Number(amount)} onClick={submit}>
            Gửi yêu cầu rút
          </button>
          <button style={S.btnGhost} onClick={() => setAmount(String(s.balance))}>
            Rút toàn bộ
          </button>
        </div>
        <p style={{ ...S.tiny, marginTop: 10 }}>
          Admin duyệt xong sẽ chuyển khoản theo thông tin ngân hàng bạn đã cài đặt ở tab Cấu Hình.
        </p>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Lịch sử phiếu rút</h3>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Số Tiền</th>
                <th style={S.th}>Hình Thức</th>
                <th style={S.th}>Trạng Thái</th>
                <th style={S.th}>Ngày Tạo</th>
                <th style={S.th}>Mã Giao Dịch</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td style={S.td}><b>{money(p.amount)}</b></td>
                  <td style={S.td}>{p.type === 'auto' ? 'Tự động' : 'Thủ công'}</td>
                  <td style={S.td}><Badge s={p.status} /></td>
                  <td style={S.td}>{new Date(p.created_at).toLocaleString('vi-VN')}</td>
                  <td style={S.td}>{p.payment_reference || '—'}</td>
                  <td style={S.td}>
                    {p.status === 'pending' && (
                      <div style={{ textAlign: 'right' }}>
                        <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => cancel(p.id)}>
                          Huỷ phiếu
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!payouts.length && (
                <tr>
                  <td colSpan={6} style={S.empty}>Chưa có phiếu rút nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ------------------------- Cấu hình ------------------------- */
function SettingsTab({ me, onSaved }) {
  const modal = useModal()
  const p = me?.profile || {}
  const [f, setF] = useState({
    auto_payout_enabled: !!p.auto_payout_enabled,
    auto_payout_weekday: p.auto_payout_weekday ?? '',
    auto_payout_min_amount: p.auto_payout_min_amount ?? 0,
    bank_name: p.bank_name || '',
    bank_account_number: p.bank_account_number || '',
    bank_account_name: p.bank_account_name || '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setF({
      auto_payout_enabled: !!p.auto_payout_enabled,
      auto_payout_weekday: p.auto_payout_weekday ?? '',
      auto_payout_min_amount: p.auto_payout_min_amount ?? 0,
      bank_name: p.bank_name || '',
      bank_account_number: p.bank_account_number || '',
      bank_account_name: p.bank_account_name || '',
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
      await modal.alert({ tone: 'success', title: 'Đã lưu', message: 'Cấu hình rút tiền đã được cập nhật thành công.' })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={S.panel}>
        <h3 style={S.h3}>Bảng giá &amp; hoa hồng (quy định bởi Quản trị viên)</h3>
        <div style={{ ...S.walletRow, marginTop: 12 }}>
          <WBlock label="Giá thiệp lẻ" val={money(p.single_price)} />
          <WBlock label="Giá combo 2 thiệp" val={money(p.combo_price)} />
          <WBlock label="Tỉ lệ hoa hồng" val={pct(p.commission_rate)} />
        </div>
      </div>

      <div style={S.panel}>
        <h3 style={S.h3}>Tài khoản ngân hàng nhận tiền hoa hồng</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 12 }}>
          <div>
            <div style={S.label}>Tên ngân hàng</div>
            <input
              style={{ ...S.input, width: '100%' }}
              placeholder="VD: MB Bank, Vietcombank, Techcombank..."
              value={f.bank_name}
              onChange={(e) => setF({ ...f, bank_name: e.target.value })}
            />
          </div>
          <div>
            <div style={S.label}>Số tài khoản</div>
            <input
              style={{ ...S.input, width: '100%' }}
              placeholder="Số tài khoản ngân hàng"
              value={f.bank_account_number}
              onChange={(e) => setF({ ...f, bank_account_number: e.target.value })}
            />
          </div>
          <div>
            <div style={S.label}>Tên chủ tài khoản</div>
            <input
              style={{ ...S.input, width: '100%' }}
              placeholder="NGUYEN VAN A (in hoa không dấu)"
              value={f.bank_account_name}
              onChange={(e) => setF({ ...f, bank_account_name: e.target.value.toUpperCase() })}
            />
          </div>
        </div>

        <button style={{ ...S.btnMain, marginTop: 18 }} disabled={busy} onClick={save}>
          {busy ? 'Đang lưu...' : 'Lưu Cấu Hình Ngân Hàng'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------- Helper Badge & Styles ------------------------- */
function Badge({ s }) {
  const isOk = s === 'active' || s === 'paid'
  const isPending = s === 'pending' || s === 'pending_payment'
  const isWarn = s === 'locked' || s === 'cancelled' || s === 'rejected'

  let bg = '#f6f1eb'
  let color = '#6e625c'
  if (isOk) { bg = 'rgba(79,126,101,0.12)'; color = '#4f7e65' }
  else if (isPending) { bg = 'rgba(201,169,110,0.18)'; color = '#a38243' }
  else if (isWarn) { bg = 'rgba(192,73,56,0.1)'; color = '#c04938' }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 11.5,
      fontWeight: 600,
      padding: '3px 10px',
      borderRadius: 9999,
      background: bg,
      color,
    }}>
      {STATUS_VI[s] || s}
    </span>
  )
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#fcfaf7',
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: '#1f1917',
  },
  header: {
    padding: '24px 36px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    borderBottom: '1px solid #ede5db',
    flexWrap: 'wrap',
    gap: 16,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #d97757 0%, #c96547 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 14px rgba(217, 119, 87, 0.3)',
  },
  brand: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 18,
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
    fontFamily: "'Plus Jakarta Sans', sans-serif",
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
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  stat: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '20px 22px',
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
    position: 'relative',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    position: 'absolute',
    top: 20,
    right: 20,
  },
  statVal: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1,
    marginTop: 4,
    color: '#1f1917',
  },
  statKey: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6e625c',
    marginTop: 8,
  },
  walletBox: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '22px 24px',
    marginBottom: 20,
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
  },
  walletRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
  },
  wBlock: {
    background: '#fcfaf7',
    padding: '16px 18px',
    borderRadius: 12,
    border: '1px solid #f0e8df',
  },
  wVal: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1f1917',
  },
  panel: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '22px 24px',
    marginBottom: 20,
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
  },
  h3: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 17,
    fontWeight: 700,
    color: '#1f1917',
    marginBottom: 10,
  },
  createBox: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '22px 24px',
    marginBottom: 20,
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
  },
  createTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 14,
    color: '#1f1917',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  createRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
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
    fontSize: 13.5,
  },
  th: {
    textAlign: 'left',
    padding: '14px 18px',
    background: '#f6f1eb',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: '#9e918a',
    borderBottom: '1px solid #ede5db',
  },
  td: {
    padding: '13px 18px',
    borderBottom: '1px solid #ede5db',
    verticalAlign: 'middle',
    color: '#1f1917',
  },
  empty: {
    textAlign: 'center',
    padding: '36px 18px',
    color: '#9e918a',
    fontSize: 13.5,
  },
  acts: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  mini: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11.5,
    fontWeight: 600,
    padding: '6px 11px',
    borderRadius: 8,
    border: '1px solid #ede5db',
    background: '#f6f1eb',
    cursor: 'pointer',
    color: '#1f1917',
    transition: 'all 0.15s ease',
    textDecoration: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  miniActive: {
    background: 'linear-gradient(135deg, #d97757 0%, #c96547 100%)',
    color: '#fff',
    borderColor: 'transparent',
  },
  miniDanger: {
    borderColor: 'rgba(192,73,56,0.25)',
    background: 'rgba(192,73,56,0.08)',
    color: '#c04938',
  },
  input: {
    height: 40,
    padding: '0 12px',
    border: '1px solid #ede5db',
    borderRadius: 10,
    fontSize: 13.5,
    background: '#fff',
    color: '#1f1917',
    outline: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  label: {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#6e625c',
    marginBottom: 5,
  },
  btnMain: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #d97757 0%, #c96547 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    boxShadow: '0 4px 14px rgba(217, 119, 87, 0.3)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: '#f6f1eb',
    border: '1px solid #ede5db',
    borderRadius: 9999,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    color: '#1f1917',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  err: {
    color: '#c04938',
    fontSize: 13,
    margin: '10px 0',
    padding: '10px 14px',
    background: 'rgba(192,73,56,0.08)',
    borderRadius: 10,
    border: '1px solid rgba(192,73,56,0.2)',
  },
  tiny: {
    fontSize: 12,
    color: '#6e625c',
    marginTop: 3,
  },
  muted: {
    fontSize: 13.5,
    color: '#9e918a',
  },
  pillOk: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11.5,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 9999,
    background: 'rgba(79,126,101,0.12)',
    color: '#4f7e65',
  },
  pillLock: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11.5,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 9999,
    background: 'rgba(201,169,110,0.18)',
    color: '#a38243',
  },
  lockedBar: {
    background: 'rgba(192,73,56,0.08)',
    color: '#c04938',
    padding: '12px 36px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    fontSize: 13,
    borderBottom: '1px solid rgba(192,73,56,0.2)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(31,25,23,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 9200,
  },
  modalBox: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 20,
    padding: '28px 30px',
    maxWidth: 540,
    width: '100%',
    boxShadow: '0 20px 50px rgba(31,25,23,0.18)',
  },
  radio: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13.5,
    cursor: 'pointer',
    fontWeight: 500,
  },
  qrCard: {
    display: 'flex',
    gap: 18,
    background: '#fcfaf7',
    padding: 18,
    borderRadius: 14,
    border: '1px solid #f0e8df',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  qr: {
    borderRadius: 10,
    background: '#fff',
    padding: 6,
    border: '1px solid #ede5db',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 20,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  centerCard: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 20,
    padding: '40px 32px',
    boxShadow: '0 10px 30px rgba(31,25,23,0.06)',
    maxWidth: 420,
  },
}

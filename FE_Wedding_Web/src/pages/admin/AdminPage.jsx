import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, API_BASE } from '../../api'
import { useModal } from '../../components/Modal'
import TemplateManager from './TemplateManager'
import {
  IconShield,
  IconSparkles,
  IconUsers,
  IconMail,
  IconPalette,
  IconChevronLeft,
  IconPlus,
  IconSearch,
  IconLock,
  IconUnlock,
  IconKey,
  IconTrash2,
  IconEdit3,
  IconExternalLink,
  IconCheckCircle,
  IconAlertCircle,
  IconCheckSquare,
  IconMusic,
  IconUploadCloud,
} from '../../components/Icons'
import { CTV_ADMIN_TABS, CtvAdminTab } from './AdminCtvTabs'
import MusicManager from './MusicManager'

const TABS = [
  { id: 'overview', label: 'Tổng Quan', Icon: IconSparkles },
  { id: 'users', label: 'Tài Khoản Khách', Icon: IconUsers },
  { id: 'invitations', label: 'Quản Lý Thiệp', Icon: IconMail },
  { id: 'templates', label: 'Quản Lý Mẫu', Icon: IconPalette },
  { id: 'music', label: 'Kho Nhạc', Icon: IconMusic },
  ...CTV_ADMIN_TABS,
]

export default function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    api.getProfile()
      .then((r) => setIsAdmin(((r.data?.data || r.data)?.role) === 'admin'))
      .catch(() => setIsAdmin(false))
  }, [])

  if (isAdmin === null) {
    return (
      <div style={S.center}>
        <div style={S.centerCard}>
          <IconSparkles size={32} color="#d97757" />
          <p style={{ marginTop: 12, fontSize: 14, color: '#5c524c' }}>Đang xác thực quyền quản trị viên...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={S.center}>
        <div style={{ ...S.centerCard, borderColor: 'rgba(192,73,56,0.3)' }}>
          <p style={{ color: '#c04938', marginBottom: 14, fontSize: 15, fontWeight: 600 }}>
            Bạn không có quyền truy cập trang quản trị này.
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
            <IconShield size={22} color="#fff" />
          </div>
          <div>
            <div style={S.brand}>Wedding · Quản Trị Hệ Thống</div>
            <div style={S.sub}>Cấp tài khoản, quản lý hạn mức & mở khoá sửa thiệp</div>
          </div>
        </div>
        <button style={S.btnGhost} onClick={() => navigate('/dashboard')}>
          <IconChevronLeft size={15} />
          <span>Về Trang Khách</span>
        </button>
      </header>

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
        {tab === 'overview' && <Overview />}
        {tab === 'users' && <Users />}
        {tab === 'invitations' && <Invitations />}
        {tab === 'templates' && <TemplateManager />}
        {tab === 'music' && <MusicManager />}
        {CTV_ADMIN_TABS.some((t) => t.id === tab) && <CtvAdminTab tab={tab} />}
      </div>
    </div>
  )
}

/* ---------------- Overview ---------------- */
function Overview() {
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.admin.stats()
      .then((r) => setS(r.data?.data || r.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [])

  if (err) return <div style={S.err}>⚠️ {err}</div>
  if (!s) return <div style={{ padding: 40, textAlign: 'center', color: '#6e625c' }}>Đang tải số liệu thống kê...</div>

  const cards = [
    { label: 'Tài khoản người dùng', val: s.totalUsers, Icon: IconUsers, color: '#d97757' },
    { label: 'Tổng số thiệp đã tạo', val: s.totalInvitations, Icon: IconMail, color: '#c9a96e' },
    { label: 'Thiệp đang mở sửa', val: s.activeInvitations, Icon: IconUnlock, color: '#4f7e65' },
    { label: 'Thiệp đã khoá sửa', val: s.lockedInvitations, Icon: IconLock, color: '#c04938' },
    { label: 'Tổng khách mời', val: s.totalGuests, Icon: IconUsers, color: '#5b7bb2' },
    { label: 'Lượt phản hồi (RSVP)', val: s.totalCheckins, Icon: IconCheckSquare, color: '#8a62a6' },
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
            </div>
          )
        })}
      </div>

      <h3 style={S.h3}>Thiệp Cưới Mới Tạo Gần Đây</h3>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Tiêu đề thiệp</th>
              <th style={S.th}>Đường dẫn (Slug)</th>
              <th style={S.th}>Chủ tài khoản</th>
              <th style={S.th}>Trạng thái sửa</th>
            </tr>
          </thead>
          <tbody>
            {(s.recentInvitations || []).map((r) => (
              <tr key={r.id}>
                <td style={S.td}>
                  <strong>{r.title_vi || 'Thiệp không tiêu đề'}</strong>
                </td>
                <td style={S.td}>
                  <code style={S.code}>{r.slug}</code>
                </td>
                <td style={S.td}>{r.owner || '—'}</td>
                <td style={S.td}>
                  {r.lock_state?.locked ? (
                    <span style={S.pillLock}>
                      <IconLock size={12} /> Khoá sửa
                    </span>
                  ) : (
                    <span style={S.pillOk}>
                      <IconCheckCircle size={12} /> Đang mở
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- Users ---------------- */
function Users() {
  const modal = useModal()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ username: '', password: '', role: 'user', slot: 1 })
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState('')

  const load = useCallback(() => {
    api.admin.listUsers({ search })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    if (!form.username || !form.password) {
      await modal.alert({ title: 'Thiếu thông tin', message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' })
      return
    }
    setBusy(true)
    try {
      await api.admin.createUser(form)
      await modal.alert({
        tone: 'success',
        title: 'Đã tạo tài khoản',
        message: `Tài khoản "${form.username}" đã được tạo thành công với ${form.slot} lượt tạo thiệp.`,
      })
      setForm({ username: '', password: '', role: 'user', slot: 1 })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
    setBusy(false)
  }

  const addSlots = async (u) => {
    const ok = await modal.confirm({
      title: 'Cấp thêm lượt tạo thiệp',
      message: `Cộng thêm 5 lượt tạo thiệp cho tài khoản "${u.username}" (hiện đang có ${u.slot} lượt)?`,
      confirmText: '+5 lượt ngay',
    })
    if (!ok) return
    try {
      await api.admin.addSlots(u.id, 5)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const setSlots = async (u) => {
    const v = window.prompt(`Nhập số lượt tạo thiệp mới cho "${u.username}":`, String(u.slot))
    if (v == null) return
    try {
      await api.admin.updateUser(u.id, { slot: Number(v) })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const resetPw = async (u) => {
    const v = window.prompt(`Nhập mật khẩu mới cho "${u.username}":`, '')
    if (!v) return
    try {
      await api.admin.updateUser(u.id, { password: v })
      await modal.alert({ tone: 'success', title: 'Thành công', message: 'Đã đổi mật khẩu tài khoản.' })
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const toggleRole = async (u) => {
    const to = u.role === 'admin' ? 'user' : 'admin'
    const ok = await modal.confirm({
      tone: 'warn',
      title: 'Thay đổi quyền hạn',
      message: `Chuyển quyền của "${u.username}" thành ${to.toUpperCase()}?`,
    })
    if (!ok) return
    try {
      await api.admin.updateUser(u.id, { role: to })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const del = async (u) => {
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Xoá tài khoản',
      message: `Bạn có chắc muốn xoá tài khoản "${u.username}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xoá Tài Khoản',
    })
    if (!ok) return
    try {
      await api.admin.deleteUser(u.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  return (
    <div>
      {/* Create User Box */}
      <div style={S.createBox}>
        <div style={S.createTitle}>
          <IconPlus size={16} color="#d97757" />
          <span>Cấp Mới Tài Khoản Khách</span>
        </div>
        <div style={S.createRow}>
          <input
            style={S.input}
            placeholder="Tên đăng nhập (username)"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            style={S.input}
            placeholder="Mật khẩu"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select style={S.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="user">Người dùng (user)</option>
            <option value="admin">Quản trị (admin)</option>
          </select>
          <input
            style={{ ...S.input, width: 110 }}
            type="number"
            min="0"
            placeholder="Số slot"
            value={form.slot}
            onChange={(e) => setForm({ ...form, slot: Number(e.target.value) })}
          />
          <button style={S.btnMain} onClick={create} disabled={busy}>
            <IconPlus size={14} />
            <span>{busy ? 'Đang tạo...' : 'Tạo Tài Khoản'}</span>
          </button>
        </div>
      </div>

      {/* Search & Table */}
      <div style={{ position: 'relative', width: 300, margin: '6px 0 14px' }}>
        <input
          style={{ ...S.input, width: '100%', paddingLeft: 36 }}
          placeholder="Tìm kiếm username..."
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
              <th style={S.th}>Tên Đăng Nhập</th>
              <th style={S.th}>Vai Trò</th>
              <th style={S.th}>Lượt Tạo Thiệp</th>
              <th style={S.th}>Số Thiệp</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <React.Fragment key={u.id}>
                <tr>
                  <td style={S.td}>
                    <strong>{u.username}</strong>
                  </td>
                  <td style={S.td}>
                    <span style={u.role === 'admin' ? S.pillAdmin : S.pillOk}>
                      {u.role === 'admin' ? 'Quản trị (admin)' : 'Khách (user)'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <strong style={{ color: '#d97757', fontSize: 14 }}>{u.slot}</strong> lượt
                  </td>
                  <td style={S.td}>{u.invitation_count ?? 0} thiệp</td>
                  <td style={S.td}>
                    <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                      <button
                        style={{ ...S.mini, ...(expandedId === u.id ? S.miniActive : {}) }}
                        onClick={() => setExpandedId((v) => (v === u.id ? '' : u.id))}
                      >
                        <IconMail size={12} /> {expandedId === u.id ? 'Đóng' : 'Quản lý thiệp'}
                      </button>
                      <button style={S.mini} onClick={() => addSlots(u)}>+5 lượt</button>
                      <button style={S.mini} onClick={() => setSlots(u)}>Đặt lượt</button>
                      <button style={S.mini} onClick={() => resetPw(u)}>
                        <IconKey size={12} /> Mật khẩu
                      </button>
                      <button style={S.mini} onClick={() => toggleRole(u)}>
                        {u.role === 'admin' ? '↓ user' : '↑ admin'}
                      </button>
                      <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => del(u)}>
                        <IconTrash2 size={12} /> Xoá
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === u.id && (
                  <tr>
                    <td colSpan={5} style={{ ...S.td, background: '#faf6f0', padding: 0 }}>
                      <CustomerPanel user={u} navigate={navigate} modal={modal} onChanged={load} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* -------- CustomerPanel: quản lý thiệp + tạo thiệp HỘ 1 khách -------- */
function CustomerPanel({ user, navigate, modal, onChanged }) {
  const [detail, setDetail] = useState(null)
  const [templates, setTemplates] = useState([])
  const [tplId, setTplId] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.admin.getUserDetail(user.id)
      .then((r) => {
        const d = r.data?.data || r.data
        setDetail(d)
      })
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [user.id])

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
      const r = await api.admin.createUserInvitation(user.id, tplId)
      const inv = r.data?.data || r.data
      await modal.alert({
        tone: 'success',
        title: 'Đã tạo thiệp cho khách',
        message: `Đã tạo thiệp mới thuộc tài khoản "${user.username}" (không trừ lượt của khách).\nMở trình sửa ngay?`,
        confirmText: 'Để sau',
      })
      // mở editor luôn cho tiện
      navigate(`/editor/${inv.id}`)
      load(); onChanged && onChanged()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
    setBusy(false)
  }

  const del = async (inv) => {
    const ok = await modal.confirm({
      tone: 'danger', title: 'Xoá thiệp', confirmText: 'Xoá',
      message: `Xoá thiệp "${inv.title_vi}" của khách "${user.username}"?`,
    })
    if (!ok) return
    try { await api.admin.deleteInvitation(inv.id); load(); onChanged && onChanged() }
    catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
  }

  const toggleLock = async (inv) => {
    const st = inv.lock_state || {}
    try {
      if (st.locked) await api.admin.unlockInvitation(inv.id)
      else await api.admin.lockInvitation(inv.id)
      load()
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message }) }
  }

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1f1917', marginBottom: 4 }}>
        Thiệp & quyền riêng tư của khách: {user.username}
      </div>
      <div style={{ fontSize: 11.5, color: '#6e625c', marginBottom: 12 }}>
        Mọi thiệp, khách mời, phản hồi RSVP dưới đây đều thuộc riêng tài khoản này.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <select style={{ ...S.input, minWidth: 200 }} value={tplId} onChange={(e) => setTplId(e.target.value)}>
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

      {err && <div style={S.err}>⚠️ {err}</div>}

      {!detail ? (
        <div style={{ fontSize: 12.5, color: '#6e625c' }}>Đang tải...</div>
      ) : detail.invitations.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#6e625c' }}>Khách này chưa có thiệp nào.</div>
      ) : (
        <div style={{ ...S.tableWrap, background: '#fff' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Thiệp</th>
                <th style={S.th}>Cô dâu & chú rể</th>
                <th style={S.th}>Khách / RSVP</th>
                <th style={S.th}>Lượt sửa</th>
                <th style={S.th}>Trạng thái</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {detail.invitations.map((inv) => {
                const st = inv.lock_state || {}
                return (
                  <tr key={inv.id}>
                    <td style={S.td}>
                      <strong>{inv.title_vi}</strong>
                      <div style={S.tiny}>
                        <a href={`/${inv.invitation_slug}`} target="_blank" rel="noreferrer">/{inv.invitation_slug}</a>
                      </div>
                    </td>
                    <td style={S.td}>{inv.bride?.name_bride || '—'} & {inv.groom?.name_groom || '—'}</td>
                    <td style={S.td}>{inv.guest_count ?? 0} / {inv.checkin_count ?? 0}</td>
                    <td style={S.td}>{st.editCount ?? 0}/{st.maxEdits ?? 5}</td>
                    <td style={S.td}>
                      {st.locked
                        ? <span style={S.pillLock}><IconLock size={12} /> Khoá</span>
                        : <span style={S.pillOk}><IconUnlock size={12} /> Mở</span>}
                    </td>
                    <td style={S.td}>
                      <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                        <button style={S.mini} onClick={() => navigate(`/editor/${inv.id}`)}>
                          <IconEdit3 size={12} /> Sửa
                        </button>
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ---------------- Invitations ---------------- */
function Invitations() {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.admin.listInvitations({ search })
      .then((r) => setRows((r.data?.data || r.data).items || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const unlock = async (inv) => {
    const ok = await modal.confirm({
      tone: 'warn',
      title: 'Mở khoá sửa thiệp',
      message: `Mở khoá sửa cho thiệp "${inv.title_vi}"?\nLượt sửa sẽ được reset về ${inv.lock_state?.maxEdits ?? 5} và bỏ hạn ngày cưới.`,
      confirmText: 'Mở Khoá Ngay',
    })
    if (!ok) return
    try {
      await api.admin.unlockInvitation(inv.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const lock = async (inv) => {
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Khoá sửa thiệp',
      message: `Khoá quyền sửa thiệp "${inv.title_vi}" ngay bây giờ?`,
      confirmText: 'Khoá Sửa',
    })
    if (!ok) return
    try {
      await api.admin.lockInvitation(inv.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const del = async (inv) => {
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Xoá thiệp cưới',
      message: `Xoá thiệp "${inv.title_vi}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xoá Thiệp',
    })
    if (!ok) return
    try {
      await api.admin.deleteInvitation(inv.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  return (
    <div>
      <div style={{ position: 'relative', width: 300, marginBottom: 14 }}>
        <input
          style={{ ...S.input, width: '100%', paddingLeft: 36 }}
          placeholder="Tìm tiêu đề / slug..."
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
              <th style={S.th}>Tiêu Đề Thiệp</th>
              <th style={S.th}>Chủ Tài Khoản</th>
              <th style={S.th}>Cô Dâu & Chú Rể</th>
              <th style={S.th}>Lượt Sửa</th>
              <th style={S.th}>Hạn Sửa</th>
              <th style={S.th}>Trạng Thái</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const st = inv.lock_state || {}
              return (
                <tr key={inv.id}>
                  <td style={S.td}>
                    <strong>{inv.title_vi}</strong>
                    <div style={S.tiny}>
                      <a href={`/${inv.invitation_slug}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        /{inv.invitation_slug} <IconExternalLink size={11} />
                      </a>
                    </div>
                  </td>
                  <td style={S.td}>{inv.user?.username || '—'}</td>
                  <td style={S.td}>
                    {inv.bride?.name_bride || '—'} & {inv.groom?.name_groom || '—'}
                  </td>
                  <td style={S.td}>
                    {st.editCount ?? 0}/{st.maxEdits ?? 5}
                  </td>
                  <td style={S.td}>
                    {st.editDeadline ? new Date(st.editDeadline).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={S.td}>
                    {st.locked ? (
                      <span style={S.pillLock}>
                        <IconLock size={12} /> {st.reason === 'past_wedding' ? 'Quá hạn' : 'Hết lượt'}
                      </span>
                    ) : (
                      <span style={S.pillOk}>
                        <IconCheckCircle size={12} /> Mở sửa
                      </span>
                    )}
                  </td>
                  <td style={S.td}>
                    <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                      {st.locked ? (
                        <button style={S.mini} onClick={() => unlock(inv)}>
                          <IconUnlock size={12} /> Mở khoá
                        </button>
                      ) : (
                        <button style={S.mini} onClick={() => lock(inv)}>
                          <IconLock size={12} /> Khoá
                        </button>
                      )}
                      <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => del(inv)}>
                        <IconTrash2 size={12} /> Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- Templates ---------------- */
function Templates() {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.admin.listTemplates()
      .then((r) => setRows(r.data?.data || r.data || []))
      .catch((e) => setErr(e?.response?.data?.message || e.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rename = async (t) => {
    const v = window.prompt('Nhập tên hiển thị mới cho mẫu:', t.template_name || '')
    if (!v) return
    try {
      await api.admin.updateTemplate(t.id, { template_name: v })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  const del = async (t) => {
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Xoá mẫu giao diện',
      message: `Bạn có chắc muốn xoá mẫu "${t.template_name}"?`,
      confirmText: 'Xoá Mẫu',
    })
    if (!ok) return
    try {
      await api.admin.deleteTemplate(t.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: e?.response?.data?.message || e.message })
    }
  }

  return (
    <div>
      <div style={{ ...S.tiny, marginBottom: 14, padding: '10px 14px', background: '#f6f1eb', borderRadius: 10, border: '1px solid #ede5db' }}>
        💡 Thêm mẫu mới: Upload gói <code>.zip</code> qua API <code>POST /api/invitation-templates/upload</code> (chỉ quyền admin).
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Tên Mẫu</th>
              <th style={S.th}>Mã Template Code</th>
              <th style={S.th}>Số Thiệp Đang Dùng</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td style={S.td}>
                  <strong>{t.template_name}</strong>
                </td>
                <td style={S.td}>
                  <code style={S.code}>{t.template_code}</code>
                </td>
                <td style={S.td}>{t.invitation_count ?? 0} thiệp</td>
                <td style={S.td}>
                  <div style={{ ...S.acts, justifyContent: 'flex-end' }}>
                    <button style={S.mini} onClick={() => rename(t)}>
                      <IconEdit3 size={12} /> Đổi tên
                    </button>
                    <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => del(t)}>
                      <IconTrash2 size={12} /> Xoá
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- Kho Nhạc ---------------- */
function musicSrc(u) {
  if (/^https?:\/\//i.test(u)) return u
  return API_BASE + (u.startsWith('/') ? u : '/' + u)
}

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
    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
    flexShrink: 0,
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
  h3: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    margin: '32px 0 14px',
    color: '#1f1917',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
  },
  stat: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 16,
    padding: '20px 22px',
    boxShadow: '0 2px 8px rgba(31,25,23,0.04)',
  },
  statVal: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1,
    marginTop: 4,
  },
  statKey: {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#6e625c',
    letterSpacing: '0.02em',
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
  code: {
    fontSize: 12,
    fontFamily: 'Courier New, monospace',
    background: '#f6f1eb',
    padding: '2px 8px',
    borderRadius: 4,
    color: '#5c524c',
  },
  tiny: {
    fontSize: 12,
    color: '#6e625c',
    marginTop: 3,
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
  },
  miniActive: {
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
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
  },
  btnMain: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    boxShadow: '0 4px 14px rgba(217, 119, 87, 0.3)',
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
  err: {
    color: '#c04938',
    fontSize: 13,
    margin: '10px 0',
    padding: '10px 14px',
    background: 'rgba(192,73,56,0.08)',
    borderRadius: 10,
    border: '1px solid rgba(192,73,56,0.2)',
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
  pillAdmin: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11.5,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 9999,
    background: 'rgba(124,58,237,0.12)',
    color: '#7c3aed',
  },
}

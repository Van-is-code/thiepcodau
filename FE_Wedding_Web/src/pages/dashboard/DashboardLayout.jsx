import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useModal } from '../../components/Modal'
import {
  IconHeart,
  IconMail,
  IconPalette,
  IconSend,
  IconUsers,
  IconCheckSquare,
  IconUser,
  IconShield,
  IconCreditCard,
  IconLogOut,
  IconSparkles,
} from '../../components/Icons'
import './dashboard.css'

const sidebarGroups = [
  {
    label: 'Thiệp Cưới',
    items: [
      { to: '/dashboard', label: 'Thiệp Cưới', Icon: IconMail },
      { to: '/dashboard/templates', label: 'Kho Mẫu Templates', Icon: IconPalette },
    ],
  },
  {
    label: 'Khách Mời & RSVP',
    items: [
      { to: '/dashboard/invite', label: 'Tạo Link Mời', Icon: IconSend },
      { to: '/dashboard/guests', label: 'Danh Sách Khách', Icon: IconUsers },
      { to: '/dashboard/checkins', label: 'Xác Nhận Tham Dự', Icon: IconCheckSquare },
    ],
  },
  {
    label: 'Cá Nhân',
    items: [
      { to: '/profile', label: 'Hồ Sơ & Cài Đặt', Icon: IconUser },
    ],
  },
]

const topTabs = sidebarGroups.slice(0, 2).flatMap((group) => group.items)

export default function DashboardLayout({ onLogout }) {
  const navigate = useNavigate()
  const modal = useModal()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    api.getProfile()
      .then((r) => {
        const p = r.data?.data || r.data
        setProfile(p)
        // CTV không dùng trang khách — chuyển thẳng sang bảng điều khiển CTV.
        if (p?.role === 'ctv') navigate('/ctv', { replace: true })
      })
      .catch(() => setProfile(null))
  }, [navigate])

  const isAdmin = profile?.role === 'admin'
  const isCtv = profile?.role === 'ctv'

  const handleLogout = () => {
    localStorage.removeItem('token')
    onLogout?.()
    navigate('/auth')
  }

  const username = useMemo(() => {
    if (profile?.username) return profile.username
    try {
      const p = JSON.parse(localStorage.getItem('profile') || 'null')
      return p?.username || 'user'
    } catch (_e) {
      return 'user'
    }
  }, [profile])

  const askMoreSlots = async () => {
    await modal.alert({
      tone: 'default',
      title: 'Thêm lượt tạo thiệp',
      message: `Hiện hệ thống chưa mở mua gói online tự động.\n\nĐể được cấp thêm lượt tạo thiệp (hoặc mở khoá chỉnh sửa thiệp), quý khách vui lòng liên hệ trực tiếp Quản trị viên.\n\nSố lượt hiện có của bạn: ${profile?.slot ?? '—'} lượt`,
      confirmText: 'Đã hiểu',
    })
  }

  return (
    <div className="lay">
      <aside className="sb">
        <div className="sb-brand">
          <div className="sb-logo-badge">
            <IconHeart size={20} color="#fff" />
          </div>
          <div className="sb-brand-info">
            <div className="sb-mark">Wedding</div>
            <div className="sb-sub">Invitation App</div>
          </div>
        </div>

        <nav>
          {sidebarGroups.map((group) => (
            <div className="nav-grp" key={group.label}>
              <div className="nav-lbl">{group.label}</div>
              {group.items.map((item) => {
                const ItemIcon = item.Icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    className={({ isActive }) => `nav-it${isActive ? ' on' : ''}`}
                  >
                    <span className="nav-icon">
                      <ItemIcon size={17} />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}

          {(isAdmin || isCtv) && (
            <div className="nav-grp">
              <div className="nav-lbl">Hệ Thống</div>
              {isAdmin && (
                <NavLink to="/admin" className={({ isActive }) => `nav-it${isActive ? ' on' : ''}`}>
                  <span className="nav-icon">
                    <IconShield size={17} />
                  </span>
                  <span>Trang Quản Trị</span>
                </NavLink>
              )}
              {isCtv && (
                <NavLink to="/ctv" className={({ isActive }) => `nav-it${isActive ? ' on' : ''}`}>
                  <span className="nav-icon">
                    <IconUsers size={17} />
                  </span>
                  <span>Bảng Điều Khiển CTV</span>
                </NavLink>
              )}
            </div>
          )}
        </nav>

        <div className="nav-bot">
          <div className="nav-user">
            <div className="nav-av">{String(username).charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nav-uname">{username}</div>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                {isAdmin ? 'Quản trị viên' : `Còn ${profile?.slot ?? 0} lượt tạo`}
              </div>
            </div>
          </div>
          <div className="nav-bot-acts">
            <button type="button" className="btn-sm ghost nav-bot-btn" onClick={askMoreSlots}>
              <IconCreditCard size={15} />
              <span>Thêm Lượt Tạo Thiệp</span>
            </button>
            <button type="button" className="btn-sm ghost nav-bot-btn" onClick={handleLogout}>
              <IconLogOut size={15} />
              <span>Đăng Xuất</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="ptabs">
          {topTabs.map((tab) => {
            const TabIcon = tab.Icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/dashboard'}
                className={({ isActive }) => `ptab${isActive ? ' on' : ''}`}
              >
                <TabIcon size={16} />
                <span>{tab.label}</span>
              </NavLink>
            )
          })}
        </div>

        <section className="pg">
          <Outlet />
        </section>
      </main>
    </div>
  )
}

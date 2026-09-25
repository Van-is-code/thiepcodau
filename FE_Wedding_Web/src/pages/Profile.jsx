import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconUser,
  IconSettings,
  IconMail,
  IconPalette,
  IconCreditCard,
  IconLogOut,
  IconEdit3,
  IconCheck,
  IconX,
  IconSparkles,
  IconCalendar,
  IconShield,
  IconChevronLeft,
} from '../components/Icons'

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.thiepcuoi.me').replace(/\/+$/, '')

const css = `
  .profile-layout {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 260px 1fr;
    background-color: var(--bg-main);
  }

  .profile-sidebar {
    background: var(--bg-card);
    padding: 32px 20px;
    border-right: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: sticky;
    top: 0;
  }

  .profile-sb-brand {
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 600;
    color: var(--text-main);
    padding: 0 12px 20px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .profile-nav-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 14px;
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 500;
    text-align: left;
    transition: all 0.2s ease;
    margin-bottom: 4px;
  }

  .profile-nav-btn:hover {
    color: var(--primary);
    background: var(--primary-light);
  }

  .profile-nav-btn.active {
    background: var(--primary-light);
    color: var(--primary);
    font-weight: 600;
  }

  .profile-content {
    padding: 40px 48px 60px;
    overflow-y: auto;
    max-width: 1080px;
  }

  .profile-hero {
    display: flex;
    align-items: center;
    gap: 28px;
    margin-bottom: 36px;
    padding: 32px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    flex-wrap: wrap;
  }

  .profile-avatar {
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: var(--primary-gradient);
    border: 3px solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 32px;
    font-weight: 700;
    box-shadow: 0 6px 20px rgba(217, 119, 87, 0.28);
    flex-shrink: 0;
  }

  .profile-hero-text h1 {
    font-family: var(--font-serif);
    font-size: 32px;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 4px;
    line-height: 1.2;
  }

  .profile-hero-text p {
    font-size: 13.5px;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .profile-hero-meta {
    display: flex;
    gap: 18px;
    font-size: 13px;
    flex-wrap: wrap;
  }

  .profile-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
  }

  .profile-meta-item strong {
    color: var(--primary);
  }

  .profile-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 24px;
  }

  .profile-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 28px 30px;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
  }

  .profile-card h3 {
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 20px;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .profile-field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 18px;
  }

  .profile-field-group:last-child {
    margin-bottom: 0;
  }

  .profile-field-label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-subtle);
    font-weight: 700;
  }

  .profile-field-value {
    font-size: 15px;
    color: var(--text-main);
    font-weight: 500;
  }

  .profile-input {
    width: 100%;
    height: 42px;
    padding: 0 13px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    font-size: 14px;
    background: var(--bg-subtle);
    color: var(--text-main);
  }

  .profile-input:focus {
    border-color: var(--primary);
    background: #fff;
  }

  @media (max-width: 860px) {
    .profile-layout {
      grid-template-columns: 1fr;
    }
    .profile-sidebar {
      display: none;
    }
    .profile-content {
      padding: 24px 20px 60px;
    }
    .profile-hero {
      text-align: center;
      justify-content: center;
      flex-direction: column;
    }
  }
`

export default function Profile() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('info')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Bạn cần đăng nhập')
        navigate('/auth')
        return
      }
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Lỗi tải hồ sơ')
      const p = data.data || data
      setProfile(p)
      setEditForm(p)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Cập nhật thất bại')
      setProfile(editForm)
      setEditMode(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="empty" style={{ margin: '60px auto', maxWidth: 460 }}>
        <div className="empty-ico">
          <IconSparkles size={32} color="#d97757" />
        </div>
        <p className="empty-txt">Đang tải thông tin hồ sơ của bạn...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty" style={{ margin: '60px auto', maxWidth: 460, borderColor: 'rgba(192,73,56,0.3)' }}>
        <p className="empty-txt" style={{ color: '#c04938', marginBottom: 14 }}>❌ {error}</p>
        <button className="btn-main" onClick={fetchProfile}>
          Thử Lại
        </button>
      </div>
    )
  }

  return (
    <>
      <style>{css}</style>
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-sb-brand">
            <IconSparkles size={18} color="#d97757" />
            <span>Tài Khoản</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className={`profile-nav-btn${tab === 'info' ? ' active' : ''}`}
              onClick={() => setTab('info')}
            >
              <IconUser size={16} />
              <span>Thông Tin Cá Nhân</span>
            </button>
            <button
              className={`profile-nav-btn${tab === 'settings' ? ' active' : ''}`}
              onClick={() => setTab('settings')}
            >
              <IconSettings size={16} />
              <span>Cài Đặt Tài Khoản</span>
            </button>
            <button className="profile-nav-btn" onClick={() => navigate('/dashboard')}>
              <IconMail size={16} />
              <span>Quản Lý Thiệp Cưới</span>
            </button>
            <button className="profile-nav-btn" onClick={() => navigate('/dashboard/templates')}>
              <IconPalette size={16} />
              <span>Kho Mẫu Templates</span>
            </button>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <button
              className="profile-nav-btn"
              style={{ color: '#c04938', width: '100%' }}
              onClick={() => {
                localStorage.removeItem('token')
                navigate('/auth')
              }}
            >
              <IconLogOut size={16} />
              <span>Đăng Xuất</span>
            </button>
          </div>
        </aside>

        <main className="profile-content">
          <div style={{ marginBottom: 20 }}>
            <button
              className="btn-ghost"
              style={{ padding: '6px 14px', fontSize: 12.5 }}
              onClick={() => navigate('/dashboard')}
            >
              <IconChevronLeft size={14} />
              <span>Về Trang Quản Lý</span>
            </button>
          </div>

          {profile && (
            <>
              <div className="profile-hero">
                <div className="profile-avatar">{String(profile.username || 'U').charAt(0).toUpperCase()}</div>
                <div className="profile-hero-text">
                  <h1>{profile.username}</h1>
                  <p>{profile.email || 'Chưa cập nhật email liên hệ'}</p>
                  <div className="profile-hero-meta">
                    <div className="profile-meta-item">
                      <IconSparkles size={14} color="#d97757" />
                      <span>
                        Lượt tạo thiệp còn lại: <strong>{profile.slot || 0} lượt</strong>
                      </span>
                    </div>
                    <div className="profile-meta-item">
                      <IconCalendar size={14} />
                      <span>
                        Tham gia từ: <strong>{new Date(profile.created_at || Date.now()).toLocaleDateString('vi-VN')}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {tab === 'info' && (
                <div className="profile-cards-grid">
                  <div className="profile-card">
                    <h3>
                      <IconUser size={18} color="#d97757" />
                      <span>Thông Tin Tài Khoản</span>
                    </h3>

                    {editMode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="profile-field-group">
                          <label className="profile-field-label">Tên đăng nhập (không thể đổi)</label>
                          <input className="profile-input" type="text" value={editForm.username || ''} disabled />
                        </div>
                        <div className="profile-field-group">
                          <label className="profile-field-label">Email liên hệ</label>
                          <input
                            className="profile-input"
                            type="email"
                            placeholder="email@vidu.com"
                            value={editForm.email || ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                          <button className="btn-main" onClick={handleSave} disabled={saving}>
                            <IconCheck size={14} />
                            <span>{saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
                          </button>
                          <button className="btn-ghost" onClick={() => setEditMode(false)}>
                            <IconX size={14} />
                            <span>Huỷ</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="profile-field-group">
                          <label className="profile-field-label">Tên đăng nhập</label>
                          <div className="profile-field-value">{profile.username}</div>
                        </div>
                        <div className="profile-field-group">
                          <label className="profile-field-label">Email liên hệ</label>
                          <div className="profile-field-value">{profile.email || 'Chưa cập nhật'}</div>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <button className="btn-ghost" onClick={() => setEditMode(true)}>
                            <IconEdit3 size={14} />
                            <span>Chỉnh Sửa Thông Tin</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="profile-card">
                    <h3>
                      <IconSparkles size={18} color="#c9a96e" />
                      <span>Hạn Mức & Quyền Lợi</span>
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="profile-field-group">
                        <label className="profile-field-label">Số lượt tạo thiệp hiện có</label>
                        <div className="profile-field-value" style={{ fontSize: 18, color: '#d97757', fontWeight: 700 }}>
                          {profile.slot || 0} lượt
                        </div>
                      </div>
                      <div className="profile-field-group">
                        <label className="profile-field-label">Loại tài khoản</label>
                        <div className="profile-field-value">
                          {profile.role === 'admin' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#7c3aed', fontWeight: 600 }}>
                              <IconShield size={14} /> Quản Trị Viên (Admin)
                            </span>
                          ) : (
                            'Người Dùng (User)'
                          )}
                        </div>
                      </div>
                      <div className="profile-field-group">
                        <label className="profile-field-label">Trạng thái tài khoản</label>
                        <div className="profile-field-value" style={{ color: '#4f7e65' }}>
                          ● Đang hoạt động bình thường
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'settings' && (
                <div className="profile-card" style={{ maxWidth: 540 }}>
                  <h3>
                    <IconSettings size={18} color="#d97757" />
                    <span>Cài Đặt & Đăng Xuất</span>
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Đăng xuất tài khoản trên thiết bị này hoặc liên hệ hỗ trợ nếu cần đổi mật khẩu / nâng cấp lượt tạo thiệp.
                    </p>
                    <div>
                      <button
                        className="btn-ghost"
                        style={{ color: '#c04938', borderColor: 'rgba(192,73,56,0.3)' }}
                        onClick={() => {
                          localStorage.removeItem('token')
                          navigate('/auth')
                        }}
                      >
                        <IconLogOut size={15} />
                        <span>Đăng Xuất Khỏi Thiết Bị</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}

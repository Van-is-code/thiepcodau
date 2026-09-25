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
  IconKey,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconCheckCircle,
} from '../components/Icons'
import { api, API_BASE } from '../api'

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

  .profile-pw-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .profile-eye-btn {
    position: absolute;
    right: 10px;
    background: transparent;
    border: none;
    color: var(--text-subtle);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 4px;
    transition: color 0.2s ease;
  }

  .profile-eye-btn:hover {
    color: var(--primary);
  }

  .profile-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    font-size: 13.5px;
    line-height: 1.5;
    margin-bottom: 18px;
  }

  .profile-alert-error {
    background: rgba(192, 73, 56, 0.08);
    border: 1px solid rgba(192, 73, 56, 0.25);
    color: #c04938;
  }

  .profile-alert-success {
    background: rgba(79, 126, 101, 0.1);
    border: 1px solid rgba(79, 126, 101, 0.25);
    color: var(--sage);
  }

  .profile-mobile-tabs {
    display: none;
    gap: 8px;
    margin-bottom: 24px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .profile-mobile-tab-btn {
    padding: 8px 16px;
    border-radius: 9999px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-card);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
  }

  .profile-mobile-tab-btn.active {
    background: var(--primary-light);
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 600;
  }

  @media (max-width: 860px) {
    .profile-layout {
      grid-template-columns: 1fr;
    }
    .profile-sidebar {
      display: none;
    }
    .profile-mobile-tabs {
      display: flex;
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

  // Password state
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwAlert, setPwAlert] = useState(null)

  const handleChangePassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setPwAlert(null)

    if (!pwForm.currentPassword) {
      setPwAlert({ type: 'error', msg: 'Vui lòng nhập mật khẩu hiện tại' })
      return
    }
    if (!pwForm.newPassword) {
      setPwAlert({ type: 'error', msg: 'Vui lòng nhập mật khẩu mới' })
      return
    }
    if (pwForm.newPassword.length < 6) {
      setPwAlert({ type: 'error', msg: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
      return
    }
    if (pwForm.newPassword === pwForm.currentPassword) {
      setPwAlert({ type: 'error', msg: 'Mật khẩu mới phải khác mật khẩu hiện tại' })
      return
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwAlert({ type: 'error', msg: 'Mật khẩu xác nhận không trùng khớp' })
      return
    }

    try {
      setPwLoading(true)
      const res = await api.changePassword(pwForm.currentPassword, pwForm.newPassword)
      setPwAlert({
        type: 'success',
        msg: res.data?.message || 'Đổi mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới từ lần đăng nhập sau.',
      })
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setPwAlert({
        type: 'error',
        msg: err.response?.data?.message || err.message || 'Đổi mật khẩu thất bại',
      })
    } finally {
      setPwLoading(false)
    }
  }

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
      const url = `${API_BASE}/api/users/profile`.replace(/^\/\//, '/')
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Máy chủ phản hồi không đúng định dạng JSON (' + res.status + ')')
      }
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
      const url = `${API_BASE}/api/users/profile`.replace(/^\/\//, '/')
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Máy chủ phản hồi không đúng định dạng JSON (' + res.status + ')')
      }
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
              onClick={() => { setTab('info'); setPwAlert(null); }}
            >
              <IconUser size={16} />
              <span>Thông Tin Cá Nhân</span>
            </button>
            <button
              className={`profile-nav-btn${tab === 'password' ? ' active' : ''}`}
              onClick={() => { setTab('password'); setPwAlert(null); }}
            >
              <IconKey size={16} />
              <span>Đổi Mật Khẩu</span>
            </button>
            <button
              className={`profile-nav-btn${tab === 'settings' ? ' active' : ''}`}
              onClick={() => { setTab('settings'); setPwAlert(null); }}
            >
              <IconSettings size={16} />
              <span>Cài Đặt Tài Khoản</span>
            </button>
            <button className="profile-nav-btn" onClick={() => navigate('/dashboard')}>
              <IconMail size={16} />
              <span>Quản Lý Thiệp Cưới</span>
            </button>
            <button className="profile-nav-btn" onClick={() => navigate('/templates')}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button
              className="btn-ghost"
              style={{ padding: '6px 14px', fontSize: 12.5 }}
              onClick={() => navigate('/dashboard')}
            >
              <IconChevronLeft size={14} />
              <span>Về Trang Quản Lý</span>
            </button>
          </div>

          <div className="profile-mobile-tabs">
            <button
              className={`profile-mobile-tab-btn${tab === 'info' ? ' active' : ''}`}
              onClick={() => { setTab('info'); setPwAlert(null); }}
            >
              <IconUser size={14} />
              <span>Thông Tin</span>
            </button>
            <button
              className={`profile-mobile-tab-btn${tab === 'password' ? ' active' : ''}`}
              onClick={() => { setTab('password'); setPwAlert(null); }}
            >
              <IconKey size={14} />
              <span>Đổi Mật Khẩu</span>
            </button>
            <button
              className={`profile-mobile-tab-btn${tab === 'settings' ? ' active' : ''}`}
              onClick={() => { setTab('settings'); setPwAlert(null); }}
            >
              <IconSettings size={14} />
              <span>Cài Đặt</span>
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

              {tab === 'password' && (
                <div className="profile-card" style={{ maxWidth: 540 }}>
                  <h3>
                    <IconKey size={19} color="#d97757" />
                    <span>Thay Đổi Mật Khẩu</span>
                  </h3>

                  <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    Để bảo vệ an toàn cho tài khoản của bạn, vui lòng nhập mật khẩu hiện tại và tạo mật khẩu mới (tối thiểu 6 ký tự).
                  </p>

                  {pwAlert && (
                    <div className={`profile-alert profile-alert-${pwAlert.type}`}>
                      {pwAlert.type === 'error' ? (
                        <IconAlertCircle size={18} color="#c04938" />
                      ) : (
                        <IconCheckCircle size={18} color="#4f7e65" />
                      )}
                      <span>{pwAlert.msg}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="profile-field-group">
                      <label className="profile-field-label">Mật khẩu hiện tại</label>
                      <div className="profile-pw-wrap">
                        <input
                          className="profile-input"
                          type={showCurrentPw ? 'text' : 'password'}
                          placeholder="Nhập mật khẩu đang dùng..."
                          value={pwForm.currentPassword}
                          onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                          style={{ paddingRight: 40 }}
                          autoComplete="current-password"
                        />
                        <button
                          className="profile-eye-btn"
                          type="button"
                          onClick={() => setShowCurrentPw((v) => !v)}
                          tabIndex={-1}
                          aria-label="Hiện/Ẩn mật khẩu"
                        >
                          {showCurrentPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="profile-field-group">
                      <label className="profile-field-label">Mật khẩu mới</label>
                      <div className="profile-pw-wrap">
                        <input
                          className="profile-input"
                          type={showNewPw ? 'text' : 'password'}
                          placeholder="Tối thiểu 6 ký tự..."
                          value={pwForm.newPassword}
                          onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                          style={{ paddingRight: 40 }}
                          autoComplete="new-password"
                        />
                        <button
                          className="profile-eye-btn"
                          type="button"
                          onClick={() => setShowNewPw((v) => !v)}
                          tabIndex={-1}
                          aria-label="Hiện/Ẩn mật khẩu"
                        >
                          {showNewPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="profile-field-group">
                      <label className="profile-field-label">Xác nhận mật khẩu mới</label>
                      <div className="profile-pw-wrap">
                        <input
                          className="profile-input"
                          type={showConfirmPw ? 'text' : 'password'}
                          placeholder="Nhập lại mật khẩu mới..."
                          value={pwForm.confirmPassword}
                          onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                          style={{ paddingRight: 40 }}
                          autoComplete="new-password"
                        />
                        <button
                          className="profile-eye-btn"
                          type="button"
                          onClick={() => setShowConfirmPw((v) => !v)}
                          tabIndex={-1}
                          aria-label="Hiện/Ẩn mật khẩu"
                        >
                          {showConfirmPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button className="btn-main" type="submit" disabled={pwLoading}>
                        <IconKey size={15} />
                        <span>{pwLoading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {tab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 540 }}>
                  <div className="profile-card">
                    <h3>
                      <IconKey size={19} color="#d97757" />
                      <span>Đổi Mật Khẩu Nhanh</span>
                    </h3>
                    <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                      Bạn có thể cập nhật mật khẩu tài khoản bất cứ lúc nào để tăng cường tính bảo mật.
                    </p>
                    <div>
                      <button className="btn-main" onClick={() => setTab('password')}>
                        <IconKey size={15} />
                        <span>Mở Form Đổi Mật Khẩu</span>
                      </button>
                    </div>
                  </div>

                  <div className="profile-card">
                    <h3>
                      <IconSettings size={18} color="#d97757" />
                      <span>Đăng Xuất Tài Khoản</span>
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Đăng xuất tài khoản trên thiết bị này. Bạn có thể đăng nhập lại bất kỳ lúc nào.
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
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}

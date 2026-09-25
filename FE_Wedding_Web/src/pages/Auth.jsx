import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconUser,
  IconKey,
  IconEye,
  IconEyeOff,
  IconSparkles,
  IconHeart,
  IconShield,
  IconMail,
  IconAlertCircle,
  IconCheckCircle,
} from '../components/Icons'
import { API_BASE } from '../api'

const css = `
  .auth-page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1.05fr;
    background-color: var(--bg-main);
  }

  .auth-hero-panel {
    position: relative;
    background: linear-gradient(145deg, #fdf7f2 0%, #f6ebe0 50%, #ede0d2 100%);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 60px 48px;
    border-right: 1px solid var(--border-subtle);
  }

  .auth-hero-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 20% 20%, rgba(217, 119, 87, 0.15) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 80%, rgba(201, 169, 110, 0.12) 0%, transparent 60%);
    pointer-events: none;
  }

  .auth-hero-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 2;
  }

  .auth-hero-logo {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    background: var(--primary-gradient);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: var(--shadow-glow);
  }

  .auth-hero-brand-name {
    font-family: var(--font-serif);
    font-size: 24px;
    font-weight: 600;
    color: var(--text-main);
    letter-spacing: -0.01em;
  }

  .auth-hero-content {
    position: relative;
    z-index: 2;
    margin: 40px 0;
  }

  .auth-hero-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--primary);
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(217, 119, 87, 0.2);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    margin-bottom: 20px;
    box-shadow: var(--shadow-sm);
  }

  .auth-hero-title {
    font-family: var(--font-serif);
    font-size: 46px;
    font-weight: 500;
    line-height: 1.15;
    color: var(--text-main);
    letter-spacing: -0.02em;
    margin-bottom: 18px;
  }

  .auth-hero-title em {
    font-style: italic;
    color: var(--primary);
  }

  .auth-hero-desc {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-muted);
    max-width: 440px;
  }

  .auth-features-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    position: relative;
    z-index: 2;
  }

  .auth-feature-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.9);
    padding: 12px 16px;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .auth-feature-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--primary-light);
    color: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .auth-feature-text {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-main);
  }

  /* Right Form Area */
  .auth-form-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 36px;
    background-color: var(--bg-main);
  }

  .auth-card {
    width: 100%;
    max-width: 420px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 24px;
    padding: 40px 36px;
    box-shadow: var(--shadow-md);
    animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .auth-card-head {
    margin-bottom: 28px;
    text-align: left;
  }

  .auth-card-title {
    font-family: var(--font-serif);
    font-size: 32px;
    font-weight: 600;
    color: var(--text-main);
    line-height: 1.2;
    margin-bottom: 8px;
  }

  .auth-card-sub {
    font-size: 13.5px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .auth-fields {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .auth-field label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  .auth-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .auth-input-icon {
    position: absolute;
    left: 14px;
    color: var(--text-subtle);
    pointer-events: none;
    transition: color 0.2s ease;
  }

  .auth-input-wrap:focus-within .auth-input-icon {
    color: var(--primary);
  }

  .auth-input {
    width: 100%;
    height: 48px;
    padding: 0 14px 0 44px;
    font-size: 14px;
    color: var(--text-main);
    background: var(--bg-subtle);
    border: 1.5px solid var(--border-subtle);
    border-radius: var(--radius-md);
    outline: none;
    transition: all 0.2s ease;
  }

  .auth-input:focus {
    border-color: var(--primary);
    background: #fff;
    box-shadow: 0 0 0 4px var(--primary-light);
  }

  .auth-eye-btn {
    position: absolute;
    right: 12px;
    color: var(--text-subtle);
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 6px;
    transition: color 0.2s ease;
  }

  .auth-eye-btn:hover {
    color: var(--primary);
  }

  .auth-submit-btn {
    width: 100%;
    height: 50px;
    margin-top: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    background: var(--primary-gradient);
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    box-shadow: var(--shadow-glow);
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .auth-submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px -2px rgba(217, 119, 87, 0.4);
  }

  .auth-submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .auth-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    line-height: 1.5;
    animation: fadeIn 0.2s ease;
  }

  .auth-alert-error {
    background: rgba(192, 73, 56, 0.08);
    border: 1px solid rgba(192, 73, 56, 0.25);
    color: #c04938;
  }

  .auth-alert-success {
    background: rgba(79, 126, 101, 0.1);
    border: 1px solid rgba(79, 126, 101, 0.25);
    color: var(--sage);
  }

  .auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-subtle);
    margin: 8px 0;
  }

  .auth-divider::before,
  .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-subtle);
  }

  .auth-footer-note {
    text-align: center;
    font-size: 12.5px;
    color: var(--text-muted);
    line-height: 1.6;
  }

  .auth-footer-note strong {
    color: var(--primary);
  }

  /* Responsive */
  @media (max-width: 900px) {
    .auth-page {
      grid-template-columns: 1fr;
    }
    .auth-hero-panel {
      display: none;
    }
    .auth-form-panel {
      padding: 40px 20px;
    }
    .auth-card {
      padding: 32px 24px;
      box-shadow: var(--shadow-sm);
    }
  }
`

export default function Auth({ onLogin }) {
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState(null)
  const [form, setForm] = useState({ username: '', password: '' })

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleLogin = async () => {
    if (!form.username || !form.password) {
      setAlert({ type: 'error', msg: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' })
      return
    }
    setLoading(true)
    setAlert(null)
    try {
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Đăng nhập thất bại')
      const token = data.data?.token || data.token || data.access_token
      if (!token) throw new Error('Không nhận được mã xác thực')

      setAlert({ type: 'success', msg: `Chào mừng trở lại, ${form.username}!` })
      if (typeof onLogin === 'function') {
        onLogin(token)
      }
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setAlert({ type: 'error', msg: e.message || 'Lỗi đăng nhập' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="auth-page">
        {/* Left Hero Panel */}
        <div className="auth-hero-panel">
          <div className="auth-hero-brand">
            <div className="auth-hero-logo">
              <IconHeart size={22} color="#fff" />
            </div>
            <span className="auth-hero-brand-name">Wedding Invitation</span>
          </div>

          <div className="auth-hero-content">
            <div className="auth-hero-tag">
              <IconSparkles size={14} color="#d97757" />
              Nền tảng thiệp cưới điện tử hiện đại
            </div>
            <h1 className="auth-hero-title">
              Trao gửi yêu thương,
              <br />
              trọn vẹn <em>ngày hạnh phúc</em>
            </h1>
            <p className="auth-hero-desc">
              Tạo và quản lý thiệp cưới online sang trọng theo phong cách cá nhân hoá. Tự động quét QR mừng cưới,
              theo dõi khách mời check-in và gửi lời chúc dễ dàng.
            </p>
          </div>

          <div className="auth-features-grid">
            <div className="auth-feature-pill">
              <div className="auth-feature-icon">
                <IconMail size={16} />
              </div>
              <span className="auth-feature-text">Thiết kế 9:16 phong cách</span>
            </div>
            <div className="auth-feature-pill">
              <div className="auth-feature-icon">
                <IconShield size={16} />
              </div>
              <span className="auth-feature-text">Quản lý khách mời thông minh</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-head">
              <h2 className="auth-card-title">Đăng Nhập</h2>
              <p className="auth-card-sub">Nhập thông tin tài khoản để quản lý thiệp cưới của bạn</p>
            </div>

            <div className="auth-fields">
              {alert && (
                <div className={`auth-alert auth-alert-${alert.type}`}>
                  {alert.type === 'error' ? (
                    <IconAlertCircle size={17} color="#c04938" />
                  ) : (
                    <IconCheckCircle size={17} color="#4f7e65" />
                  )}
                  <span>{alert.msg}</span>
                </div>
              )}

              <div className="auth-field">
                <label>Tên đăng nhập</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <IconUser size={18} />
                  </span>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="Nhập username..."
                    value={form.username}
                    onChange={setField('username')}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label>Mật khẩu</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <IconKey size={18} />
                  </span>
                  <input
                    className="auth-input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={setField('password')}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    autoComplete="current-password"
                    style={{ paddingRight: 46 }}
                  />
                  <button
                    className="auth-eye-btn"
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    tabIndex={-1}
                    aria-label="Hiện/Ẩn mật khẩu"
                  >
                    {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              <button
                className="auth-submit-btn"
                type="button"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng Nhập Ngay</span>
                    <IconSparkles size={16} />
                  </>
                )}
              </button>

              <div className="auth-divider">hỗ trợ tài khoản</div>

              <p className="auth-footer-note">
                Chưa có tài khoản? Vui lòng <strong>liên hệ quản trị viên</strong> để được tạo tài khoản & cấp lượt tạo thiệp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

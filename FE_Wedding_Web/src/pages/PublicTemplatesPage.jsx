import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import {
  IconEye,
  IconSparkles,
  IconMusic,
  IconSearch,
  IconPalette,
  IconUser,
  IconLock,
  IconHeart,
  IconRing,
  IconChevronRight,
  IconCheckCircle,
} from '../components/Icons'

const css = `
  .pub-page {
    min-height: 100vh;
    background-color: #faf7f2;
    color: #2d2621;
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
  }

  .pub-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(254, 252, 249, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(229, 220, 210, 0.8);
    padding: 14px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .pub-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
  }

  .pub-logo-box {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(135deg, #d97757 0%, #c96547 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 4px 12px rgba(217, 119, 87, 0.35);
  }

  .pub-brand-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: #1f1917;
    letter-spacing: -0.01em;
  }

  .pub-nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pub-btn-login {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    background: linear-gradient(135deg, #d97757 0%, #c96547 100%);
    color: #fff;
    border-radius: 9999px;
    border: none;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(217, 119, 87, 0.3);
    transition: all 0.2s ease;
    text-decoration: none;
  }

  .pub-btn-login:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(217, 119, 87, 0.4);
  }

  .pub-hero {
    position: relative;
    padding: 60px 24px 44px;
    text-align: center;
    max-width: 900px;
    margin: 0 auto;
    overflow: hidden;
  }

  .pub-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(217, 119, 87, 0.1);
    color: #d97757;
    border: 1px solid rgba(217, 119, 87, 0.25);
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 18px;
  }

  .pub-hero-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(32px, 5vw, 48px);
    font-weight: 700;
    color: #1f1917;
    line-height: 1.25;
    margin-bottom: 16px;
  }

  .pub-hero-title span {
    background: linear-gradient(135deg, #d97757 0%, #b84b2c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .pub-hero-sub {
    font-size: 16px;
    line-height: 1.65;
    color: #63574e;
    max-width: 720px;
    margin: 0 auto 32px;
  }

  /* Search & Filter Toolbar */
  .pub-toolbar {
    max-width: 1140px;
    margin: 0 auto 36px;
    padding: 0 24px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .pub-search-box {
    position: relative;
    flex: 1;
    min-width: 260px;
    max-width: 440px;
  }

  .pub-search-input {
    width: 100%;
    padding: 12px 16px 12px 42px;
    background: #fff;
    border: 1px solid #e5dcd2;
    border-radius: 9999px;
    font-size: 14px;
    color: #2d2621;
    outline: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    transition: all 0.2s ease;
  }

  .pub-search-input:focus {
    border-color: #d97757;
    box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.15);
  }

  .pub-search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #9c8e82;
    display: flex;
  }

  .pub-tabs {
    display: flex;
    gap: 8px;
    background: #ede6dc;
    padding: 4px;
    border-radius: 9999px;
  }

  .pub-tab-btn {
    padding: 7px 16px;
    border: none;
    background: transparent;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    color: #6e6157;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pub-tab-btn.active {
    background: #fff;
    color: #1f1917;
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
  }

  /* Grid Layout */
  .pub-grid-wrap {
    max-width: 1140px;
    width: 100%;
    margin: 0 auto;
    padding: 0 24px 60px;
    flex: 1;
  }

  .pub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 28px;
  }

  .pub-card {
    background: #fff;
    border: 1px solid #ebdcd0;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(45, 38, 33, 0.05);
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    flex-direction: column;
  }

  .pub-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 16px 36px rgba(45, 38, 33, 0.12);
    border-color: #d97757;
  }

  .pub-card-preview {
    position: relative;
    width: 100%;
    height: 380px;
    background: #f3ece4;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pub-card-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s ease;
  }

  .pub-card:hover .pub-card-thumb {
    transform: scale(1.05);
  }

  .pub-card-mockup {
    width: 82%;
    height: 88%;
    background: linear-gradient(145deg, #fffcf9 0%, #f7eee4 100%);
    border: 1px solid #e4d7ca;
    border-radius: 14px;
    box-shadow: 0 8px 24px rgba(45, 38, 33, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    text-align: center;
    position: relative;
    transition: transform 0.3s ease;
  }

  .pub-card:hover .pub-card-mockup {
    transform: translateY(-4px) scale(1.02);
  }

  .pub-mockup-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #c9a96e;
    margin-bottom: 12px;
  }

  .pub-mockup-names {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 19px;
    font-weight: 700;
    color: #2b221d;
    line-height: 1.35;
    margin-bottom: 12px;
  }

  .pub-mockup-divider {
    width: 36px;
    height: 2px;
    background: #d97757;
    margin-bottom: 12px;
    border-radius: 2px;
  }

  .pub-mockup-date {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: #8c7d71;
  }

  .pub-card-overlay {
    position: absolute;
    inset: 0;
    background: rgba(31, 25, 23, 0.35);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  .pub-card:hover .pub-card-overlay {
    opacity: 1;
  }

  .pub-overlay-btn {
    padding: 10px 20px;
    background: #fff;
    color: #1f1917;
    font-size: 13px;
    font-weight: 700;
    border-radius: 9999px;
    border: none;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .pub-card-badges {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 5;
  }

  .pub-badge-item {
    font-size: 10.5px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 9999px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .pub-badge-music {
    background: rgba(255, 255, 255, 0.95);
    color: #d97757;
    border: 1px solid rgba(217, 119, 87, 0.3);
  }

  .pub-badge-code {
    background: rgba(31, 25, 23, 0.85);
    color: #fff;
  }

  /* Card Body */
  .pub-card-body {
    padding: 18px 20px 20px;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .pub-card-title {
    font-size: 16px;
    font-weight: 700;
    color: #1f1917;
    margin-bottom: 6px;
    line-height: 1.35;
  }

  .pub-card-desc {
    font-size: 13px;
    color: #7a6e65;
    line-height: 1.5;
    margin-bottom: 18px;
    flex: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .pub-card-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .pub-action-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 10px;
    background: #f7f1ea;
    border: 1px solid #e8dcce;
    color: #594a40;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pub-action-preview:hover {
    background: #ede3d7;
    color: #1f1917;
  }

  .pub-action-use {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 10px;
    background: linear-gradient(135deg, #d97757 0%, #c96547 100%);
    border: none;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(217, 119, 87, 0.25);
    transition: all 0.2s ease;
  }

  .pub-action-use:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(217, 119, 87, 0.4);
  }

  .pub-action-use:disabled {
    opacity: 0.65;
    cursor: wait;
  }

  /* Call To Action Banner */
  .pub-cta-banner {
    max-width: 1140px;
    margin: 20px auto 60px;
    padding: 0 24px;
    width: 100%;
  }

  .pub-cta-card {
    background: linear-gradient(135deg, #1f1917 0%, #302622 100%);
    border-radius: 24px;
    padding: 44px 36px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 28px;
    box-shadow: 0 16px 40px rgba(31, 25, 23, 0.15);
    position: relative;
    overflow: hidden;
  }

  .pub-cta-card::before {
    content: '';
    position: absolute;
    right: -40px;
    top: -40px;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(217, 119, 87, 0.3) 0%, transparent 70%);
    pointer-events: none;
  }

  .pub-cta-text h3 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 26px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #fff;
  }

  .pub-cta-text p {
    font-size: 14.5px;
    color: #d1c5bb;
    max-width: 580px;
    line-height: 1.6;
  }

  .pub-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 13px 28px;
    background: linear-gradient(135deg, #e58d6f 0%, #d97757 100%);
    color: #fff;
    font-size: 14.5px;
    font-weight: 700;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(217, 119, 87, 0.4);
    transition: all 0.25s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .pub-cta-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 26px rgba(217, 119, 87, 0.5);
  }

  /* Modal */
  .pub-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  }

  .pub-modal {
    background: #fff;
    border-radius: 22px;
    padding: 32px 28px;
    max-width: 440px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 50px rgba(0,0,0,0.25);
  }

  .pub-modal-icon {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: #fdf0eb;
    color: #d97757;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }

  .pub-modal-title {
    font-size: 19px;
    font-weight: 700;
    color: #1f1917;
    margin-bottom: 10px;
  }

  .pub-modal-desc {
    font-size: 14px;
    color: #63574e;
    line-height: 1.6;
    margin-bottom: 24px;
  }

  .pub-modal-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Footer */
  .pub-footer {
    background: #f4ecdf;
    border-top: 1px solid #e3d6c7;
    padding: 24px;
    text-align: center;
    font-size: 13px;
    color: #85766c;
  }

  @media (max-width: 768px) {
    .pub-header {
      padding: 12px 16px;
    }
    .pub-toolbar {
      flex-direction: column;
      align-items: stretch;
    }
    .pub-search-box {
      max-width: 100%;
    }
    .pub-cta-card {
      flex-direction: column;
      text-align: center;
      padding: 32px 20px;
    }
    .pub-cta-btn {
      width: 100%;
      justify-content: center;
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`

export default function PublicTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all') // 'all', 'music'
  const [creatingId, setCreatingId] = useState('')
  const [promptLoginModal, setPromptLoginModal] = useState(null)

  const token = localStorage.getItem('token')

  useEffect(() => {
    let cancelled = false
    const fetchTemplates = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await api.getTemplates()
        const raw = res.data?.data?.items || res.data?.items || res.data?.data || res.data || []
        const list = Array.isArray(raw) ? raw : []
        if (!cancelled) setTemplates(list)
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || 'Không tải được danh sách mẫu')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchTemplates()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchSearch =
        !search.trim() ||
        (tpl.template_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (tpl.template_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (tpl.description || '').toLowerCase().includes(search.toLowerCase())

      if (!matchSearch) return false

      if (tab === 'music') {
        return !!tpl.has_music_box
      }
      return true
    })
  }, [templates, search, tab])

  const handleUseTemplate = async (tpl) => {
    if (creatingId) return

    // If not logged in, prompt user to log in or create account
    if (!token) {
      setPromptLoginModal(tpl)
      return
    }

    try {
      setCreatingId(tpl.id)
      const res = await api.createDraftInvitation(tpl.id)
      const invitation = res.data?.data || res.data
      navigate(`/editor/${invitation.id}`)
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Không thể tạo thiệp từ mẫu này')
    } finally {
      setCreatingId('')
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="pub-page">
        {/* Navigation Bar */}
        <header className="pub-header">
          <div className="pub-brand" onClick={() => navigate('/templates')}>
            <div className="pub-logo-box">
              <IconRing size={20} color="#fff" />
            </div>
            <span className="pub-brand-title">Thiệp Cưới Sang Trọng</span>
          </div>

          <div className="pub-nav">
            {token ? (
              <button className="pub-btn-login" onClick={() => navigate('/dashboard')}>
                <IconUser size={16} />
                <span>Trang Quản Lý Thiệp</span>
              </button>
            ) : (
              <button className="pub-btn-login" onClick={() => navigate('/auth')}>
                <IconLock size={15} />
                <span>Đăng Nhập</span>
              </button>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <section className="pub-hero">
          <div className="pub-hero-badge">
            <IconSparkles size={14} color="#d97757" />
            <span>Bộ Sưu Tập Mẫu Thiệp 2026</span>
          </div>
          <h1 className="pub-hero-title">
            Kho Mẫu Thiệp Cưới Điện Tử <span>Hiện Đại & Tinh Tế</span>
          </h1>
          <p className="pub-hero-sub">
            Khám phá trọn bộ thiết kế chuẩn mobile 9:16, âm thanh du dương, hiệu ứng mở phong bì sang trọng.
            Trải nghiệm xem thử tương tác ngay trên trình duyệt mà không cần đăng nhập.
          </p>
        </section>

        {/* Search & Tabs Toolbar */}
        <div className="pub-toolbar">
          <div className="pub-search-box">
            <span className="pub-search-icon">
              <IconSearch size={18} />
            </span>
            <input
              type="text"
              className="pub-search-input"
              placeholder="Tìm theo tên mẫu, mã mẫu (vd: Vintage, Sang Trọng, QC...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="pub-tabs">
            <button
              className={`pub-tab-btn ${tab === 'all' ? 'active' : ''}`}
              onClick={() => setTab('all')}
            >
              <IconPalette size={14} />
              <span>Tất Cả ({templates.length})</span>
            </button>
            <button
              className={`pub-tab-btn ${tab === 'music' ? 'active' : ''}`}
              onClick={() => setTab('music')}
            >
              <IconMusic size={14} />
              <span>Có Hộp Nhạc</span>
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        <main className="pub-grid-wrap">
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7a6e65' }}>
              <IconSparkles size={36} color="#d97757" />
              <p style={{ marginTop: 14, fontSize: 15, fontWeight: 500 }}>Đang tải danh sách mẫu thiệp cưới...</p>
            </div>
          )}

          {error && (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 20px',
                background: '#fff',
                border: '1px solid rgba(192,73,56,0.2)',
                borderRadius: 16,
                color: '#c04938',
                maxWidth: 480,
                margin: '0 auto',
              }}
            >
              <p style={{ fontWeight: 600 }}>❌ {error}</p>
            </div>
          )}

          {!loading && !error && filteredTemplates.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: '#fff',
                borderRadius: 20,
                border: '1px solid #ebdcd0',
                maxWidth: 480,
                margin: '0 auto',
              }}
            >
              <IconPalette size={36} color="#c9a96e" />
              <h3 style={{ marginTop: 14, fontSize: 17, fontWeight: 700, color: '#1f1917' }}>
                Không tìm thấy mẫu thiệp phù hợp
              </h3>
              <p style={{ marginTop: 6, fontSize: 13.5, color: '#7a6e65' }}>
                Vui lòng thử từ khoá tìm kiếm khác hoặc chọn tab Tất Cả.
              </p>
            </div>
          )}

          {!loading && !error && filteredTemplates.length > 0 && (
            <div className="pub-grid">
              {filteredTemplates.map((tpl) => (
                <article key={tpl.id} className="pub-card">
                  <div
                    className="pub-card-preview"
                    onClick={() => navigate(`/preview/${tpl.id}`)}
                    title="Bấm để xem thử toàn màn hình"
                  >
                    <div className="pub-card-badges">
                      {tpl.template_code && (
                        <span className="pub-badge-item pub-badge-code">
                          #{tpl.template_code}
                        </span>
                      )}
                      {tpl.has_music_box && (
                        <span className="pub-badge-item pub-badge-music">
                          <IconMusic size={11} /> Có Nhạc
                        </span>
                      )}
                    </div>

                    {tpl.thumbnail_url ? (
                      <img
                        src={tpl.thumbnail_url}
                        alt={tpl.template_name}
                        className="pub-card-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <div className="pub-card-mockup">
                        <div className="pub-mockup-badge">Wedding Invitation</div>
                        <div className="pub-mockup-names">
                          {tpl.template_name || 'Thiệp Cưới Mẫu'}
                        </div>
                        <div className="pub-mockup-divider" />
                        <div className="pub-mockup-date">SAVE THE DATE</div>
                      </div>
                    )}

                    <div className="pub-card-overlay">
                      <button className="pub-overlay-btn" type="button">
                        <IconEye size={15} />
                        <span>Xem Trực Tiếp</span>
                      </button>
                    </div>
                  </div>

                  <div className="pub-card-body">
                    <h2 className="pub-card-title">{tpl.template_name}</h2>
                    <p className="pub-card-desc">
                      {tpl.description || 'Thiết kế sang trọng, tối ưu tỉ lệ vàng 9:16 trên mọi dòng điện thoại thông minh.'}
                    </p>

                    <div className="pub-card-actions">
                      <button
                        className="pub-action-preview"
                        type="button"
                        onClick={() => navigate(`/preview/${tpl.id}`)}
                      >
                        <IconEye size={15} />
                        <span>Xem Thử</span>
                      </button>

                      <button
                        className="pub-action-use"
                        type="button"
                        disabled={creatingId === tpl.id}
                        onClick={() => handleUseTemplate(tpl)}
                      >
                        {creatingId === tpl.id ? (
                          <span>Đang mở...</span>
                        ) : (
                          <>
                            <IconSparkles size={14} />
                            <span>Chọn Mẫu</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        {/* CTA Banner */}
        <section className="pub-cta-banner">
          <div className="pub-cta-card">
            <div className="pub-cta-text">
              <h3>Bạn Đã Chọn Được Mẫu Thiệp Ưng Ý?</h3>
              <p>
                Đăng nhập ngay để cá nhân hoá thông tin ngày cưới, ảnh cưới của cô dâu chú rể, danh sách khách mời,
                chọn bài hát hoặc tự tải file ghi âm lời chúc gửi gắm tới những người thân yêu!
              </p>
            </div>
            {token ? (
              <button className="pub-cta-btn" onClick={() => navigate('/dashboard')}>
                <span>Quản Lý Thiệp Của Tôi</span>
                <IconChevronRight size={18} />
              </button>
            ) : (
              <button className="pub-cta-btn" onClick={() => navigate('/auth')}>
                <span>Đăng Nhập Tạo Thiệp Ngay</span>
                <IconChevronRight size={18} />
              </button>
            )}
          </div>
        </section>

        {/* Prompt Login Modal for Guests */}
        {promptLoginModal && (
          <div className="pub-modal-backdrop" onClick={() => setPromptLoginModal(null)}>
            <div className="pub-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pub-modal-icon">
                <IconLock size={26} />
              </div>
              <h3 className="pub-modal-title">Đăng Nhập Để Chọn Mẫu</h3>
              <p className="pub-modal-desc">
                Bạn đang chọn mẫu <strong>"{promptLoginModal.template_name}"</strong>. Vui lòng đăng nhập để lưu thiệp
                vào danh sách và bắt đầu chỉnh sửa ảnh, nhạc và thông tin cưới của riêng bạn.
              </p>
              <div className="pub-modal-actions">
                <button
                  className="pub-btn-login"
                  style={{ width: '100%', justifyContent: 'center', height: 46 }}
                  onClick={() => navigate('/auth')}
                >
                  <IconUser size={16} />
                  <span>Đăng Nhập Ngay</span>
                </button>
                <button
                  className="pub-action-preview"
                  style={{ width: '100%', justifyContent: 'center', height: 44 }}
                  onClick={() => {
                    const id = promptLoginModal.id
                    setPromptLoginModal(null)
                    navigate(`/preview/${id}`)
                  }}
                >
                  <IconEye size={16} />
                  <span>Xem Thử Mẫu Này Trước</span>
                </button>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8c7e73',
                    fontSize: 13,
                    marginTop: 6,
                    cursor: 'pointer',
                  }}
                  onClick={() => setPromptLoginModal(null)}
                >
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="pub-footer">
          <p>© 2026 Thiệp Cưới Điện Tử — Nền tảng thiết kế thiệp cưới online cao cấp.</p>
        </footer>
      </div>
    </>
  )
}

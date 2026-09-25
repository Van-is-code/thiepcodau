import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { formatDate, invitationName, invitationSlug, toArray } from './helpers'
import BankQrUpload from '../../components/BankQrUpload'
import {
  IconMail,
  IconPlus,
  IconSparkles,
  IconUser,
  IconCalendar,
  IconMapPin,
  IconExternalLink,
  IconEdit3,
  IconImage,
  IconMusic,
  IconChevronDown,
  IconLock,
  IconCopy,
  IconCheck,
} from '../../components/Icons'

export default function InvitationsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState('')
  const [activeTab, setActiveTab] = useState('thiep')
  const [slot, setSlot] = useState(null)
  const [copiedSlug, setCopiedSlug] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await api.getInvitations()
        setItems(toArray(res.data))
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Không tải được danh sách thiệp')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [])

  useEffect(() => {
    api.getProfile()
      .then((res) => setSlot((res.data?.data || res.data)?.slot ?? 0))
      .catch(() => setSlot(null))
  }, [])

  useEffect(() => {
    if (!openId && items[0]?.id) {
      setOpenId(String(items[0].id))
    }
  }, [items, openId])

  const quota = useMemo(() => ({ remain: slot, warn: slot !== null && slot <= 1 }), [slot])

  const handleCopyLink = (slug) => {
    if (!slug) return
    const url = `${window.location.origin}/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(''), 2000)
  }

  if (loading) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 600 }}>
        <div className="empty-ico">
          <IconSparkles size={32} color="#d97757" />
        </div>
        <p className="empty-txt">Đang tải danh sách thiệp cưới của bạn...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 600, borderColor: 'rgba(192,73,56,0.3)' }}>
        <div className="empty-ico" style={{ color: '#c04938' }}>⚠️</div>
        <p className="empty-txt" style={{ color: '#c04938' }}>Lỗi: {error}</p>
      </div>
    )
  }

  return (
    <div className="pg">
      <div className="ph-row">
        <div>
          <p className="ph-ew">
            <IconSparkles size={14} />
            Quản Lý & Xuất Bản
          </p>
          <h1 className="ph-t">Danh Sách Thiệp Cưới</h1>
          <p className="ph-d">Quản lý nội dung, hình ảnh, tài khoản mừng cưới và xuất bản thiệp của bạn.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className={`quota-badge${quota.warn ? ' warn' : ''}`}>
            <span>Lượt tạo còn lại:</span>
            <strong>{quota.remain ?? '—'}</strong>
          </div>
          <button className="btn-main" onClick={() => navigate('/dashboard/templates')}>
            <IconPlus size={16} />
            <span>Tạo Thiệp Mới</span>
          </button>
        </div>
      </div>

      <div className="inv-list">
        {items.length === 0 ? (
          <div className="empty">
            <div className="empty-ico">
              <IconMail size={40} color="#d97757" />
            </div>
            <p className="empty-txt" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-main)', marginBottom: 6 }}>
              Bạn chưa tạo thiệp cưới nào
            </p>
            <p className="empty-txt" style={{ marginBottom: 18 }}>
              Hãy chọn một mẫu trong Kho Mẫu để bắt đầu tạo thiệp cưới tinh tế cho ngày trọng đại!
            </p>
            <button className="btn-main" onClick={() => navigate('/dashboard/templates')}>
              <IconPlus size={16} />
              <span>Khám Phá Kho Mẫu Ngay</span>
            </button>
          </div>
        ) : (
          items.map((inv) => {
            const isOpen = String(openId) === String(inv.id)
            const slug = invitationSlug(inv)
            const isLocked = Boolean(inv.lock_state?.locked)
            const editsLeft = inv.lock_state?.editsLeft

            return (
              <article key={inv.id} className={`inv-card${isOpen ? ' open' : ''}`}>
                <div
                  className="inv-hd"
                  onClick={() => {
                    setOpenId((value) => (String(value) === String(inv.id) ? '' : String(inv.id)))
                    setActiveTab('thiep')
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="inv-dot">
                    <IconMail size={22} />
                  </div>
                  <div className="inv-meta">
                    <div className="inv-title">
                      <span>{inv.title_vi || inv.title || 'Thiệp Cưới Hạnh Phúc'}</span>
                      {isLocked ? (
                        <span
                          title={inv.lock_state.reason === 'past_wedding' ? 'Đã qua ngày cưới + 3 ngày' : 'Đã hết lượt sửa'}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: 9999,
                            background: 'rgba(201, 169, 110, 0.18)',
                            color: '#a38243',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <IconLock size={12} /> Khoá sửa
                        </span>
                      ) : editsLeft != null ? (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: 9999,
                            background: 'rgba(79, 126, 101, 0.12)',
                            color: '#4f7e65',
                          }}
                        >
                          Còn {editsLeft} lượt sửa
                        </span>
                      ) : null}
                    </div>
                    <div className="inv-sub">
                      <span className="inv-slug">/{slug || 'chua-co-slug'}</span>
                      <span className="inv-chip">
                        <IconUser size={13} color="#d97757" /> Chú rể: {inv.groom?.name_groom || inv.groom || 'Chưa nhập'}
                      </span>
                      <span className="inv-chip">
                        <IconUser size={13} color="#d97757" /> Cô dâu: {inv.bride?.name_bride || inv.bride || 'Chưa nhập'}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconCalendar size={13} /> {formatDate(inv.ceremony_date)}
                      </span>
                    </div>
                  </div>
                  <div className="inv-chev">
                    <IconChevronDown size={18} />
                  </div>
                </div>

                <div className="inv-detail" style={{ display: isOpen ? 'block' : 'none' }}>
                  <div className="dtabs">
                    {[
                      { id: 'thiep', label: 'Thông Tin Thiệp', Icon: IconMail },
                      { id: 'chure', label: 'Chú Rể & QR', Icon: IconUser },
                      { id: 'codau', label: 'Cô Dâu & QR', Icon: IconUser },
                      { id: 'media', label: 'Ảnh & Nhạc Nền', Icon: IconImage },
                    ].map((t) => {
                      const TabIcon = t.Icon
                      return (
                        <div
                          key={t.id}
                          className={`dtab${activeTab === t.id ? ' on' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveTab(t.id)}
                        >
                          <TabIcon size={15} />
                          <span>{t.label}</span>
                        </div>
                      )
                    })}
                  </div>

                  {activeTab === 'thiep' && (
                    <div className="dsec">
                      <div className="fgrid">
                        <div className="fld full">
                          <label>Đường dẫn công khai (URL)</label>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              height: 42,
                              padding: '0 13px',
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                              gap: 8,
                            }}
                          >
                            <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{window.location.origin}/</span>
                            <span style={{ fontSize: 13.5, color: 'var(--text-main)', fontWeight: 600, fontFamily: 'Courier New, monospace' }}>
                              {slug || 'chua-co-slug'}
                            </span>
                            <button
                              type="button"
                              className="btn-copy"
                              style={{ marginLeft: 'auto' }}
                              onClick={() => handleCopyLink(slug)}
                            >
                              {copiedSlug === slug ? (
                                <>
                                  <IconCheck size={13} />
                                  <span>Đã copy</span>
                                </>
                              ) : (
                                <>
                                  <IconCopy size={13} />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="fld full">
                          <label>Tiêu đề thiệp</label>
                          <input value={inv.title_vi || inv.title || ''} readOnly />
                        </div>
                        <div className="fld">
                          <label>Ngày tổ chức hôn lễ</label>
                          <input value={formatDate(inv.ceremony_date)} readOnly />
                        </div>
                        <div className="fld">
                          <label>Địa điểm tổ chức</label>
                          <input value={inv.venue_address || inv.reception_venue_address || '—'} readOnly />
                        </div>
                      </div>
                      <div className="savebar" style={{ justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
                          Xem trước thiệp hoặc mở trình sửa trực quan
                        </span>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {slug && (
                            <a className="btn-ghost" href={`/${slug}`} target="_blank" rel="noreferrer">
                              <IconExternalLink size={15} />
                              <span>Mở Thiệp Khách Xem</span>
                            </a>
                          )}
                          <button className="btn-main" onClick={() => navigate(`/editor/${inv.id}`)}>
                            <IconEdit3 size={15} />
                            <span>Chỉnh Sửa Thiệp</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'chure' && (
                    <div className="dsec">
                      <div className="fgrid">
                        <div className="fld full">
                          <label>Họ tên chú rể</label>
                          <input value={inv.groom?.name_groom || inv.groom || ''} readOnly />
                        </div>
                      </div>
                      {inv.groom_id ? (
                        <BankQrUpload role="groom" targetId={inv.groom_id} initial={inv.groom || {}} />
                      ) : null}
                      <div className="savebar" style={{ justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
                          Chạm vào chữ hoặc ảnh chú rể trên thiệp để sửa trực tiếp
                        </span>
                        <button className="btn-main" onClick={() => navigate(`/editor/${inv.id}`)}>
                          <IconEdit3 size={15} />
                          <span>Sửa Trên Thiệp</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'codau' && (
                    <div className="dsec">
                      <div className="fgrid">
                        <div className="fld full">
                          <label>Họ tên cô dâu</label>
                          <input value={inv.bride?.name_bride || inv.bride || ''} readOnly />
                        </div>
                      </div>
                      {inv.bride_id ? (
                        <BankQrUpload role="bride" targetId={inv.bride_id} initial={inv.bride || {}} />
                      ) : null}
                      <div className="savebar" style={{ justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
                          Chạm vào chữ hoặc ảnh cô dâu trên thiệp để sửa trực tiếp
                        </span>
                        <button className="btn-main" onClick={() => navigate(`/editor/${inv.id}`)}>
                          <IconEdit3 size={15} />
                          <span>Sửa Trên Thiệp</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'media' && (
                    <div className="dsec">
                      <div className="empty" style={{ padding: '32px 20px' }}>
                        <div className="empty-ico">
                          <IconImage size={32} color="#d97757" />
                        </div>
                        <div className="empty-txt" style={{ maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
                          Ảnh cưới và nhạc nền được thay thế trực tiếp trên bản xem thiệp — hãy mở trình chỉnh sửa và bấm vào bất kỳ khung ảnh nào để tải ảnh cưới của bạn lên.
                        </div>
                      </div>
                      <div className="savebar" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn-main" onClick={() => navigate(`/editor/${inv.id}`)}>
                          <IconImage size={15} />
                          <span>Mở Trình Sửa Ảnh & Nhạc</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { formatDate, invitationName, invitationSlug, toArray } from './helpers'
import BankQrUpload from '../../components/BankQrUpload'
import MusicPanel from '../../components/MusicPanel'
import ImagePickerModal from '../../components/ImagePickerModal'
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
  const [editingTitleId, setEditingTitleId] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [titleSuccessId, setTitleSuccessId] = useState('')
  const [titleError, setTitleError] = useState('')
  const [shareImagePicker, setShareImagePicker] = useState(null)
  const [savingShareImage, setSavingShareImage] = useState(false)
  const [shareImageMessage, setShareImageMessage] = useState({ id: '', text: '', error: false })

  const handleStartEditTitle = (inv) => {
    setEditingTitleId(String(inv.id))
    setTitleDraft(inv.title_vi || inv.title || '')
    setTitleError('')
  }

  const handleCancelEditTitle = () => {
    setEditingTitleId('')
    setTitleDraft('')
    setTitleError('')
  }

  const handleSaveTitle = async (invId) => {
    const trimmed = titleDraft.trim()
    if (!trimmed) {
      setTitleError('Tiêu đề thiệp không được để trống')
      return
    }
    setSavingTitle(true)
    setTitleError('')
    try {
      await api.setInvitationTitle(invId, trimmed)
      setItems((prev) =>
        prev.map((item) =>
          String(item.id) === String(invId)
            ? { ...item, title_vi: trimmed, title: trimmed }
            : item
        )
      )
      setEditingTitleId('')
      setTitleSuccessId(String(invId))
      setTimeout(() => setTitleSuccessId(''), 2500)
    } catch (err) {
      setTitleError(err?.response?.data?.message || err.message || 'Lỗi khi lưu tiêu đề')
    } finally {
      setSavingTitle(false)
    }
  }

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

  const quota = useMemo(() => ({ remain: slot, warn: slot !== null && slot <= 1 }), [slot])

  const handleCopyLink = (slug, inv) => {
    if (!slug) return
    const time = inv?.updated_at ? new Date(inv.updated_at).getTime().toString(36) : ''
    const url = time ? `${window.location.origin}/${slug}?v=${time}` : `${window.location.origin}/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(''), 2000)
  }

  const handleMusicSaved = (updated) => {
    if (!updated || !updated.id) return
    setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
  }

  const saveShareImage = async (invitation, imageUrl) => {
    if (!invitation?.id) return
    setSavingShareImage(true)
    setShareImageMessage({ id: '', text: '', error: false })
    try {
      const res = await api.setInvitationShareSettings(invitation.id, { share_image: imageUrl || '' })
      const updated = res.data?.data || res.data
      setItems((prev) => prev.map((item) => {
        if (String(item.id) !== String(invitation.id)) return item
        const nextExtra = { ...(item.extra_data || {}), ...(updated?.extra_data || {}) }
        if (imageUrl) nextExtra.share_image = imageUrl
        else delete nextExtra.share_image
        return { ...item, ...updated, images: updated?.images || item.images, extra_data: nextExtra }
      }))
      setShareImagePicker(null)
      setShareImageMessage({
        id: String(invitation.id),
        text: imageUrl ? 'Đã lưu ảnh xem trước cho mọi link của thiệp.' : 'Đã dùng lại ảnh mặc định của thiệp.',
        error: false,
      })
    } catch (err) {
      setShareImageMessage({
        id: String(invitation.id),
        text: err?.response?.data?.message || err.message || 'Không thể lưu ảnh xem trước.',
        error: true,
      })
    } finally {
      setSavingShareImage(false)
    }
  }

  const uploadShareImage = async (invitation, file) => {
    if (!invitation?.id || !file) return
    setSavingShareImage(true)
    setShareImageMessage({ id: '', text: '', error: false })
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('invitation_id', invitation.id)
      formData.append('image_type', 'share')
      formData.append('sort_order', '0')
      formData.append('image_alt', 'Ảnh xem trước khi chia sẻ thiệp')
      const res = await api.createInvitationImage(formData)
      const saved = res.data?.data || res.data
      if (!saved?.image_url) throw new Error('Không nhận được ảnh sau khi tải lên.')
      const shareRes = await api.setInvitationShareSettings(invitation.id, { share_image: saved.image_url })
      const updated = shareRes.data?.data || shareRes.data
      setItems((prev) => prev.map((item) => {
        if (String(item.id) !== String(invitation.id)) return item
        return {
          ...item,
          ...updated,
          images: updated?.images || [...(item.images || []), saved],
          extra_data: { ...(item.extra_data || {}), ...(updated?.extra_data || {}), share_image: saved.image_url },
        }
      }))
      setShareImagePicker(null)
      setShareImageMessage({ id: String(invitation.id), text: 'Đã tải và lưu ảnh xem trước cho mọi link.', error: false })
    } catch (err) {
      setShareImageMessage({
        id: String(invitation.id),
        text: err?.response?.data?.message || err.message || 'Không thể tải ảnh xem trước.',
        error: true,
      })
    } finally {
      setSavingShareImage(false)
    }
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
        <div className="inv-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
                      { id: 'media', label: 'Âm Thanh & Nhạc', Icon: IconMusic },
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
                              minHeight: 42,
                              padding: '6px 12px',
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                              gap: 8,
                              boxSizing: 'border-box',
                              width: '100%',
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                flex: '1 1 0',
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: 13,
                                fontFamily: 'Courier New, monospace',
                                color: 'var(--text-main)',
                              }}
                              title={`${window.location.origin}/${slug || ''}`}
                            >
                              <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{window.location.origin}/</span>
                              <strong>{slug || 'chua-co-slug'}</strong>
                            </div>
                            <button
                              type="button"
                              className="btn-copy"
                              style={{ marginLeft: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}
                              onClick={() => handleCopyLink(slug, inv)}
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
                          <label>Ảnh nhúng khi chia sẻ link</label>
                          <div className="share-preview-picker share-preview-picker--global">
                            {inv.extra_data?.share_image ? (
                              <img src={inv.extra_data.share_image} alt="Ảnh xem trước khi chia sẻ thiệp" />
                            ) : (
                              <div className="share-preview-empty">Dùng ảnh bìa hoặc ảnh cưới mặc định</div>
                            )}
                            <div className="share-preview-actions">
                              <strong>Hiển thị cho cả link chung và link riêng</strong>
                              <p>Ảnh này dùng trên thẻ nhúng Messenger, Zalo và Facebook; nội dung thiệp không thay đổi.</p>
                              <div>
                                <button
                                  type="button"
                                  className="btn-sm ghost"
                                  onClick={() => setShareImagePicker(inv)}
                                  disabled={savingShareImage}
                                >
                                  {savingShareImage && String(shareImagePicker?.id) === String(inv.id) ? 'Đang lưu…' : 'Chọn hoặc tải ảnh'}
                                </button>
                                {inv.extra_data?.share_image && (
                                  <button
                                    type="button"
                                    className="btn-sm ghost share-preview-remove"
                                    onClick={() => saveShareImage(inv, '')}
                                    disabled={savingShareImage}
                                  >
                                    Dùng ảnh mặc định
                                  </button>
                                )}
                              </div>
                              {shareImageMessage.id === String(inv.id) && (
                                <p className={shareImageMessage.error ? 'share-preview-message error' : 'share-preview-message'}>
                                  {shareImageMessage.text}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="fld full">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                            <label style={{ margin: 0 }}>Tiêu đề thiệp</label>
                            {editingTitleId === String(inv.id) ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn-main"
                                  style={{ padding: '3px 12px', fontSize: 12, height: 26, borderRadius: 'var(--radius-sm)' }}
                                  onClick={() => handleSaveTitle(inv.id)}
                                  disabled={savingTitle}
                                >
                                  {savingTitle ? 'Đang lưu...' : 'Lưu'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  style={{ padding: '3px 10px', fontSize: 12, height: 26, borderRadius: 'var(--radius-sm)' }}
                                  onClick={handleCancelEditTitle}
                                  disabled={savingTitle}
                                >
                                  Huỷ
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {titleSuccessId === String(inv.id) && (
                                  <span style={{ fontSize: 12, color: '#4f7e65', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <IconCheck size={12} /> Đã lưu
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  style={{ padding: '2px 8px', fontSize: 12, height: 24, display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 'var(--radius-sm)' }}
                                  onClick={() => handleStartEditTitle(inv)}
                                >
                                  <IconEdit3 size={12} />
                                  <span>Đổi tiêu đề</span>
                                </button>
                              </div>
                            )}
                          </div>
                          {editingTitleId === String(inv.id) ? (
                            <>
                              <input
                                autoFocus
                                value={titleDraft}
                                onChange={(e) => setTitleDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveTitle(inv.id)
                                  if (e.key === 'Escape') handleCancelEditTitle()
                                }}
                                placeholder="Nhập tiêu đề thiệp cưới..."
                                style={{ borderColor: 'var(--color-primary)', background: '#fff' }}
                              />
                              {titleError && (
                                <div style={{ fontSize: 12, color: 'var(--color-danger, #dc2626)', marginTop: 4 }}>
                                  {titleError}
                                </div>
                              )}
                            </>
                          ) : (
                            <input
                              value={inv.title_vi || inv.title || ''}
                              readOnly
                              onClick={() => handleStartEditTitle(inv)}
                              style={{ cursor: 'pointer' }}
                              title="Bấm để đổi tiêu đề thiệp"
                            />
                          )}
                        </div>
                        <div className="fld full">
                          <label>Tên cặp đôi hiển thị trên thiệp</label>
                          <input
                            value={
                              inv.extra_data?.couple_names ||
                              `${inv.extra_data?.groom_short_name || (inv.groom?.name_groom ? inv.groom.name_groom.trim().split(/\s+/).pop() : '')} & ${inv.extra_data?.bride_short_name || (inv.bride?.name_bride ? inv.bride.name_bride.trim().split(/\s+/).pop() : '')}`
                            }
                            readOnly
                          />
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
                        <div className="fld">
                          <label>Họ tên chú rể</label>
                          <input value={inv.groom?.name_groom || inv.groom || ''} readOnly />
                        </div>
                        <div className="fld">
                          <label>Tên gọi / hiển thị ngắn trên thiệp</label>
                          <input
                            value={
                              inv.extra_data?.groom_short_name ||
                              (inv.groom?.name_groom ? inv.groom.name_groom.trim().split(/\s+/).pop() : '')
                            }
                            readOnly
                          />
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
                        <div className="fld">
                          <label>Họ tên cô dâu</label>
                          <input value={inv.bride?.name_bride || inv.bride || ''} readOnly />
                        </div>
                        <div className="fld">
                          <label>Tên gọi / hiển thị ngắn trên thiệp</label>
                          <input
                            value={
                              inv.extra_data?.bride_short_name ||
                              (inv.bride?.name_bride ? inv.bride.name_bride.trim().split(/\s+/).pop() : '')
                            }
                            readOnly
                          />
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
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '14px 18px',
                          background: '#fdf8f4',
                          border: '1px solid #f2dbcb',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: 16,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background: '#fdebe7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--primary)',
                            }}
                          >
                            <IconImage size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main)' }}>
                              Hình ảnh cưới trên thiệp
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 2 }}>
                              Mở trình chỉnh sửa để chạm vào các khung ảnh và tải ảnh cưới của hai bạn lên
                            </div>
                          </div>
                        </div>

                        <button className="btn-main" onClick={() => navigate(`/editor/${inv.id}`)}>
                          <IconEdit3 size={15} />
                          <span>Mở Trình Sửa Để Đổi Ảnh</span>
                        </button>
                      </div>

                      {/* Music & Voice Studio */}
                      <MusicPanel
                        inline={true}
                        invitation={inv}
                        onSaved={handleMusicSaved}
                      />
                    </div>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>
      {shareImagePicker && (
        <ImagePickerModal
          slot="share"
          index={null}
          ratio={1.91}
          existingImages={shareImagePicker.images || []}
          onSelectExisting={(image) => saveShareImage(shareImagePicker, image?.image_url || '')}
          onUploadNew={(file) => uploadShareImage(shareImagePicker, file)}
          onClose={() => setShareImagePicker(null)}
        />
      )}
    </div>
  )
}

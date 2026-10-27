import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { invitationName, invitationPublicUrl, invitationShareUrl, toArray } from './helpers'
import {
  DEFAULT_PRIVATE_SHARE_DESCRIPTION,
  DEFAULT_PRIVATE_SHARE_TITLE,
  privateShareDescription,
  privateShareDescriptionTemplate,
  privateShareTitle,
  privateShareTitleTemplate,
  publicShareDescription,
  publicShareTitle,
} from '../../lib/shareMeta'
import InvitationSelector from './InvitationSelector'
import QuickShareModal from './QuickShareModal'
import ChangeSlugModal from '../../components/ChangeSlugModal'
import ImagePickerModal from '../../components/ImagePickerModal'
import {
  IconSend,
  IconSparkles,
  IconUsers,
  IconCopy,
  IconCheck,
  IconClock,
} from '../../components/Icons'

export default function InvitePage() {
  const [searchParams] = useSearchParams()
  const requestedInvitationId = searchParams.get('invitation') || ''
  const copyTimerRef = useRef(null)
  const [invitations, setInvitations] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestNote, setGuestNote] = useState('')
  const [customReceptionTime, setCustomReceptionTime] = useState('')
  const [guestLinkVisible, setGuestLinkVisible] = useState(false)
  const [createdUrl, setCreatedUrl] = useState('')
  const [isSavingGuest, setIsSavingGuest] = useState(false)
  const [guestSaveSuccess, setGuestSaveSuccess] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')
  const [sharePayload, setSharePayload] = useState(null)
  const [showSlugModal, setShowSlugModal] = useState(false)
  const [publicShareTitleDraft, setPublicShareTitleDraft] = useState('')
  const [privateShareTitleDraft, setPrivateShareTitleDraft] = useState('')
  const [publicShareDescriptionDraft, setPublicShareDescriptionDraft] = useState('')
  const [privateShareDescriptionDraft, setPrivateShareDescriptionDraft] = useState('')
  const [privateShareImageDraft, setPrivateShareImageDraft] = useState('')
  const [shareImagePickerOpen, setShareImagePickerOpen] = useState(false)
  const [shareImageUploading, setShareImageUploading] = useState(false)
  const [savingShareSettings, setSavingShareSettings] = useState(false)
  const [shareSettingsMessage, setShareSettingsMessage] = useState('')
  const [shareSettingsSection, setShareSettingsSection] = useState('')
  const [publicLinkWarning, setPublicLinkWarning] = useState('')
  const [mobileInviteMode, setMobileInviteMode] = useState('public')

  useEffect(() => {
    const loadInvitations = async () => {
      try {
        const res = await api.getInvitations()
        const data = toArray(res.data)
        setInvitations(data)
        const requestedInvitation = data.find((item) => String(item.id) === String(requestedInvitationId))
        if (requestedInvitation?.id) setSelectedId(String(requestedInvitation.id))
        else if (data[0]?.id) setSelectedId(String(data[0].id))
      } catch (_err) {
        setInvitations([])
      }
    }
    loadInvitations()
  }, [requestedInvitationId])



  useEffect(() => {
    setGuestLinkVisible(false)
    setCreatedUrl('')
    setGuestSaveSuccess(false)
    setCopiedKey('')
    setSharePayload(null)
    setCustomReceptionTime('')
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    }
  }, [selectedId])

  const currentInvitation = useMemo(
    () => invitations.find((item) => String(item.id) === String(selectedId)),
    [invitations, selectedId],
  )

  const defaultReceptionTime = useMemo(() => {
    if (!currentInvitation) return '11:00'
    const fromInv = currentInvitation.reception_time || currentInvitation.extra_data?.reception_time
    if (fromInv && String(fromInv).trim()) return String(fromInv).trim()
    return '11:00'
  }, [currentInvitation])

  const publicUrl = currentInvitation ? invitationPublicUrl(currentInvitation) : ''
  const publicShareUrl = currentInvitation ? invitationShareUrl(currentInvitation) : ''
  const displayName = currentInvitation ? invitationName(currentInvitation) : ''

  useEffect(() => {
    setPublicShareTitleDraft(publicShareTitle(currentInvitation))
    setPrivateShareTitleDraft(privateShareTitleTemplate(currentInvitation))
    setPublicShareDescriptionDraft(publicShareDescription(currentInvitation))
    setPrivateShareDescriptionDraft(privateShareDescriptionTemplate(currentInvitation))
    setPrivateShareImageDraft(String(currentInvitation?.extra_data?.share_image_private || '').trim())
    setShareSettingsMessage('')
  }, [currentInvitation?.id])

  useEffect(() => {
    const slug = currentInvitation?.invitation_slug || currentInvitation?.slug || ''
    if (!slug) {
      setPublicLinkWarning('')
      return
    }
    let cancelled = false
    api.getInvitationBySlug(slug)
      .then(() => {
        if (!cancelled) setPublicLinkWarning('')
      })
      .catch((error) => {
        if (!cancelled && error?.response?.status === 404) {
          setPublicLinkWarning('Đường dẫn này chưa có thiệp công khai. Link gửi ra sẽ chỉ hiện preview mặc định; hãy kiểm tra hoặc đổi đường dẫn thiệp.')
        }
      })
    return () => { cancelled = true }
  }, [currentInvitation?.id, currentInvitation?.invitation_slug, currentInvitation?.slug])

  const guestUrl = useMemo(() => {
    if (!publicUrl || !guestName.trim()) return ''
    const timeQuery = customReceptionTime.trim() ? `&time=${encodeURIComponent(customReceptionTime.trim())}` : ''
    return `${publicUrl}?to=${encodeURIComponent(guestName.trim())}${timeQuery}`
  }, [publicUrl, guestName, customReceptionTime])

  const activeGuestUrl = createdUrl || (guestLinkVisible ? guestUrl : '')
  const guestNoteText = guestNote.trim()

  const copyText = async (text) => {
    if (!text) return false
    await navigator.clipboard.writeText(text)
    return true
  }

  const handleCopy = async (text, key) => {
    if (!text) return
    try {
      const copied = await copyText(text)
      if (!copied) return
      setCopiedKey(key)
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopiedKey(''), 1800)
    } catch (_error) {
      setCopiedKey('')
    }
  }

  const openShare = (url, name, title) => {
    if (!url) return
    setSharePayload({ url, name: name || '', title: title || '' })
  }

  const closeShare = () => setSharePayload(null)

  const saveShareSettings = async (section) => {
    if (!currentInvitation) return
    const publicTitle = publicShareTitleDraft.trim()
    const privateTitle = privateShareTitleDraft.trim()
    const publicDescription = publicShareDescriptionDraft.trim()
    const privateDescription = privateShareDescriptionDraft.trim()
    if (!publicTitle || !privateTitle || !publicDescription || !privateDescription) {
      setShareSettingsSection(section)
      setShareSettingsMessage('Vui lòng nhập đủ tiêu đề và mô tả chia sẻ.')
      return
    }

    setSavingShareSettings(true)
    setShareSettingsSection(section)
    setShareSettingsMessage('')
    try {
      const res = await api.setInvitationShareSettings(currentInvitation.id, {
        public_title: publicTitle,
        private_title: privateTitle,
        public_description: publicDescription,
        private_description: privateDescription,
        private_image: privateShareImageDraft.trim(),
      })
      const updated = res.data?.data || res.data
      setInvitations((prev) => prev.map((item) => (
        String(item.id) !== String(currentInvitation.id)
          ? item
          : (() => {
              const nextExtra = {
                ...(item.extra_data || {}),
                ...(updated?.extra_data || {}),
                share_title_public: publicTitle,
                share_title_private: privateTitle,
                share_description_public: publicDescription,
                share_description_private: privateDescription,
              }
              if (privateShareImageDraft.trim()) nextExtra.share_image_private = privateShareImageDraft.trim()
              else delete nextExtra.share_image_private
              return { ...item, ...updated, extra_data: nextExtra }
            })()
      )))
      setShareSettingsMessage('Đã lưu. Link gửi mới sẽ dùng nội dung và ảnh xem trước này.')
    } catch (err) {
      setShareSettingsMessage(err?.response?.data?.message || err.message || 'Không thể lưu tiêu đề chia sẻ.')
    } finally {
      setSavingShareSettings(false)
    }
  }

  const selectPrivateShareImage = (image) => {
    if (!image?.image_url) return
    setPrivateShareImageDraft(image.image_url)
    setShareImagePickerOpen(false)
    setShareSettingsSection('private')
    setShareSettingsMessage('Đã chọn ảnh xem trước. Bấm lưu lời mời riêng để áp dụng.')
  }

  const uploadPrivateShareImage = async (file) => {
    if (!file || !currentInvitation?.id) return
    setShareImageUploading(true)
    setShareSettingsSection('private')
    setShareSettingsMessage('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('invitation_id', currentInvitation.id)
      formData.append('image_type', 'share')
      formData.append('sort_order', '0')
      formData.append('image_alt', 'Ảnh xem trước link riêng')
      const res = await api.createInvitationImage(formData)
      const saved = res.data?.data || res.data
      if (!saved?.image_url) throw new Error('Không nhận được ảnh sau khi tải lên.')
      setPrivateShareImageDraft(saved.image_url)
      setInvitations((prev) => prev.map((item) => (
        String(item.id) === String(currentInvitation.id)
          ? { ...item, images: [...(item.images || []), saved] }
          : item
      )))
      setShareImagePickerOpen(false)
      setShareSettingsMessage('Đã tải ảnh lên. Bấm lưu lời mời riêng để áp dụng.')
    } catch (err) {
      setShareSettingsMessage(err?.response?.data?.message || err.message || 'Không thể tải ảnh xem trước.')
    } finally {
      setShareImageUploading(false)
    }
  }

  const generateGuestUrl = async () => {
    const trimmed = guestName.trim()
    if (!trimmed) {
      alert('Vui lòng nhập tên khách mời')
      return
    }
    if (!selectedId) {
      alert('Vui lòng chọn một thiệp cưới')
      return
    }

    setIsSavingGuest(true)
    setGuestSaveSuccess(false)
    const customTime = customReceptionTime.trim() || undefined
    const timeQuery = customTime ? `&time=${encodeURIComponent(customTime)}` : ''
    try {
      const res = await api.createGuest({
        name: trimmed,
        description: guestNote.trim() || null,
        invitation_id: selectedId,
        reception_time: customTime,
      })
      const gData = res.data?.data || res.data
      let finalUrl = ''
      if (gData?.privateInvitation?.url) {
        finalUrl = `${window.location.origin}${gData.privateInvitation.url}`
      } else if (publicUrl) {
        finalUrl = `${publicUrl}?to=${encodeURIComponent(trimmed)}${timeQuery}`
      }
      setCreatedUrl(finalUrl)
      setGuestLinkVisible(true)
      setGuestSaveSuccess(true)
    } catch (err) {
      console.error('Lỗi khi lưu khách mời:', err)
      const fallbackUrl = `${publicUrl}?to=${encodeURIComponent(trimmed)}${timeQuery}`
      setCreatedUrl(fallbackUrl)
      setGuestLinkVisible(true)
    } finally {
      setIsSavingGuest(false)
    }
  }

  const renderPrivateShareImageField = (mobile = false) => (
    <div className={`share-preview-field${mobile ? ' share-preview-field--mobile' : ''}`}>
      <label>Ảnh hiển thị khi gửi link riêng</label>
      <div className="share-preview-picker">
        {privateShareImageDraft ? (
          <img src={privateShareImageDraft} alt="Ảnh xem trước link riêng" />
        ) : (
          <div className="share-preview-empty">Chưa chọn ảnh</div>
        )}
        <div className="share-preview-actions">
          <strong>Ảnh xem trước trên Messenger, Zalo và Facebook</strong>
          <p>Chỉ áp dụng cho link cá nhân hoá; nội dung thiệp không bị thay đổi.</p>
          <div>
            <button
              type="button"
              className="btn-sm ghost"
              onClick={() => setShareImagePickerOpen(true)}
              disabled={!currentInvitation || shareImageUploading}
            >
              {shareImageUploading ? 'Đang tải ảnh…' : 'Chọn hoặc tải ảnh'}
            </button>
            {privateShareImageDraft && (
              <button
                type="button"
                className="btn-sm ghost share-preview-remove"
                onClick={() => {
                  setPrivateShareImageDraft('')
                  setShareSettingsSection('private')
                  setShareSettingsMessage('Đã bỏ ảnh xem trước. Bấm lưu lời mời riêng để áp dụng.')
                }}
              >
                Dùng ảnh mặc định
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="pg invite-page-shell">
      <div className="ph-row">
        <div>
          <p className="ph-ew">
            <IconSend size={14} />
            Chia Sẻ Thiệp Mời
          </p>
          <h1 className="ph-t">Tạo Link Mời Cưới</h1>
          <p className="ph-d">Chia sẻ link chung hoặc tạo link cá nhân hoá trang trọng cho từng khách mời.</p>
        </div>
      </div>

      <InvitationSelector
        invitations={invitations}
        selectedId={selectedId}
        onChange={setSelectedId}
      />

      <div className="invite-link-settings">
          <span>Đường dẫn thiệp</span>
          <button
            type="button"
            className="btn-sm ghost"
            style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: currentInvitation?.extra_data?.slug_customized ? 0.85 : 1 }}
            onClick={() => setShowSlugModal(true)}
            disabled={!currentInvitation}
            title={currentInvitation?.extra_data?.slug_customized ? 'Đường dẫn thiệp đã được xác nhận và cố định (1 lần duy nhất)' : 'Thiết lập đường dẫn thiệp (chỉ được đặt 1 lần duy nhất)'}
          >
            <span>{currentInvitation?.extra_data?.slug_customized ? '🔒' : '🔗'}</span>
            <span>{currentInvitation?.extra_data?.slug_customized ? 'Đường Dẫn Đã Cố Định' : 'Đổi Đường Dẫn (1 Lần)'}</span>
          </button>
      </div>

      <div className="mobile-invite-workflow">
        <div className="mobile-invite-switch" role="tablist" aria-label="Loại lời mời">
          <button
            type="button"
            role="tab"
            aria-selected={mobileInviteMode === 'public'}
            className={mobileInviteMode === 'public' ? 'on' : ''}
            onClick={() => setMobileInviteMode('public')}
          >
            <IconSend size={17} /> Gửi link chung
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileInviteMode === 'private'}
            className={mobileInviteMode === 'private' ? 'on' : ''}
            onClick={() => setMobileInviteMode('private')}
          >
            <IconUsers size={17} /> Mời riêng
          </button>
        </div>

        {mobileInviteMode === 'public' ? (
          <section className="mobile-invite-card">
            <div className="mobile-invite-card-head">
              <span className="mobile-invite-kicker">Dành cho nhóm chat & mạng xã hội</span>
              <h2>Link thiệp chung</h2>
              <p>Gửi một lần cho tất cả khách mời.</p>
            </div>
            <div className="mobile-link-display">{publicUrl || 'Chưa có link thiệp'}</div>
            {publicLinkWarning && <div className="public-link-warning">{publicLinkWarning}</div>}
            <div className="mobile-link-actions">
              <button
                type="button"
                className="mobile-primary-action"
                onClick={() => openShare(publicShareUrl, '', publicShareTitleDraft)}
                disabled={!publicShareUrl}
              >
                <IconSend size={18} /> Mời nhanh
              </button>
              <button
                type="button"
                className={`mobile-secondary-action${copiedKey === 'public' ? ' ok' : ''}`}
                onClick={() => handleCopy(publicShareUrl, 'public')}
                disabled={!publicShareUrl}
              >
                {copiedKey === 'public' ? <IconCheck size={18} /> : <IconCopy size={18} />}
                {copiedKey === 'public' ? 'Đã sao chép' : 'Sao chép'}
              </button>
            </div>

            <details className="mobile-advanced-settings">
              <summary>Tùy chỉnh tiêu đề khi chia sẻ</summary>
              <div className="mobile-settings-body">
                <label htmlFor="mobile-public-share-title">Tiêu đề hiển thị</label>
                <input
                  id="mobile-public-share-title"
                  value={publicShareTitleDraft}
                  maxLength={160}
                  onChange={(e) => {
                    setPublicShareTitleDraft(e.target.value)
                    setShareSettingsMessage('')
                  }}
                />
                <label htmlFor="mobile-public-share-description">Mô tả</label>
                <textarea
                  id="mobile-public-share-description"
                  rows={3}
                  value={publicShareDescriptionDraft}
                  maxLength={300}
                  onChange={(e) => {
                    setPublicShareDescriptionDraft(e.target.value)
                    setShareSettingsMessage('')
                  }}
                />
                <button type="button" className="mobile-save-settings" onClick={() => saveShareSettings('public')} disabled={!currentInvitation || savingShareSettings}>
                  {savingShareSettings ? 'Đang lưu…' : 'Lưu nội dung chia sẻ'}
                </button>
                {shareSettingsSection === 'public' && shareSettingsMessage && <p className="mobile-settings-message">{shareSettingsMessage}</p>}
              </div>
            </details>
          </section>
        ) : (
          <section className="mobile-invite-card mobile-private-card">
            <div className="mobile-invite-card-head">
              <span className="mobile-invite-kicker">Thiệp được xưng tên từng người</span>
              <h2>Tạo lời mời riêng</h2>
              <p>Nhập tên, tạo link và gửi ngay trong một luồng.</p>
            </div>

            <div className="mobile-field">
              <label htmlFor="mobile-guest-name">Tên khách mời</label>
              <input
                id="mobile-guest-name"
                placeholder="Ví dụ: Chị Vân"
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value)
                  setGuestLinkVisible(false)
                  setGuestSaveSuccess(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') generateGuestUrl()
                }}
              />
            </div>

            <div className="mobile-field">
              <label htmlFor="mobile-guest-note">Ghi chú <span>(không bắt buộc)</span></label>
              <input id="mobile-guest-note" placeholder="Bạn thân, đồng nghiệp…" value={guestNote} onChange={(e) => setGuestNote(e.target.value)} />
            </div>

            <div className="mobile-field">
              <label htmlFor="mobile-guest-time">Giờ mời riêng <span>mặc định {defaultReceptionTime}</span></label>
              <div className="mobile-time-row">
                <input
                  id="mobile-guest-time"
                  type="time"
                  value={customReceptionTime}
                  onChange={(e) => {
                    setCustomReceptionTime(e.target.value)
                    setGuestLinkVisible(false)
                    setGuestSaveSuccess(false)
                  }}
                />
                <div className="mobile-time-chips">
                  {['11:00', '11:30', '17:30', '18:00'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={customReceptionTime === preset ? 'on' : ''}
                      onClick={() => {
                        setCustomReceptionTime(preset)
                        setGuestLinkVisible(false)
                        setGuestSaveSuccess(false)
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button type="button" className="mobile-create-invite" onClick={generateGuestUrl} disabled={isSavingGuest}>
              <IconSparkles size={18} /> {isSavingGuest ? 'Đang tạo lời mời…' : 'Tạo link mời riêng'}
            </button>

            {guestLinkVisible && activeGuestUrl && (
              <div className="mobile-created-invite">
                <div className="mobile-created-check"><IconCheck size={18} /> {guestSaveSuccess ? 'Đã lưu khách mời' : 'Link mời đã sẵn sàng'}</div>
                <strong>Kính mời {guestName || 'quý khách'}</strong>
                <span>{customReceptionTime ? `Giờ mời riêng: ${customReceptionTime}` : `Giờ mời theo thiệp: ${defaultReceptionTime}`}</span>
                <div className="mobile-link-display">{activeGuestUrl}</div>
                <div className="mobile-link-actions">
                  <button type="button" className="mobile-primary-action" onClick={() => openShare(activeGuestUrl, guestName, privateShareTitle({ extra_data: { share_title_private: privateShareTitleDraft } }, guestName))}>
                    <IconSend size={18} /> Mời ngay
                  </button>
                  <button type="button" className={`mobile-secondary-action${copiedKey === 'guest' ? ' ok' : ''}`} onClick={() => handleCopy(activeGuestUrl, 'guest')}>
                    {copiedKey === 'guest' ? <IconCheck size={18} /> : <IconCopy size={18} />}
                    {copiedKey === 'guest' ? 'Đã sao chép' : 'Sao chép'}
                  </button>
                </div>
              </div>
            )}

            <details className="mobile-advanced-settings">
              <summary>Tùy chỉnh lời mời riêng</summary>
              <div className="mobile-settings-body">
                <label htmlFor="mobile-private-share-title">Tiêu đề <code>{'{guest_name}'}</code></label>
                <input
                  id="mobile-private-share-title"
                  value={privateShareTitleDraft}
                  maxLength={160}
                  onChange={(e) => {
                    setPrivateShareTitleDraft(e.target.value)
                    setShareSettingsMessage('')
                  }}
                />
                <label htmlFor="mobile-private-share-description">Mô tả <code>{'{guest_name}'}</code></label>
                <textarea
                  id="mobile-private-share-description"
                  rows={3}
                  value={privateShareDescriptionDraft}
                  maxLength={300}
                  onChange={(e) => {
                    setPrivateShareDescriptionDraft(e.target.value)
                    setShareSettingsMessage('')
                  }}
                />
                {renderPrivateShareImageField(true)}
                <button type="button" className="mobile-save-settings" onClick={() => saveShareSettings('private')} disabled={!currentInvitation || savingShareSettings}>
                  {savingShareSettings ? 'Đang lưu…' : 'Lưu nội dung chia sẻ'}
                </button>
                {shareSettingsSection === 'private' && shareSettingsMessage && <p className="mobile-settings-message">{shareSettingsMessage}</p>}
              </div>
            </details>
          </section>
        )}
      </div>

      <div className="inv-grid">
        {/* Panel 1: Link thiệp chung */}
        <section className="inv-panel">
          <div className="inv-ph">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconSend size={18} color="#d97757" />
              <div className="inv-pt">Link Thiệp Chung</div>
            </div>
            <div className="inv-ps">Dùng để gửi chung vào nhóm chat hoặc đăng lên mạng xã hội</div>
          </div>
          <div className="inv-pb">
            <div className="url-disp">
              <span>{publicUrl || 'Chưa có link thiệp'}</span>
            </div>
            {publicLinkWarning && <div className="public-link-warning">{publicLinkWarning}</div>}
            <div className="share-btns public-link-actions">
              <button
                type="button"
                className="btn-quick-invite"
                onClick={() => openShare(publicShareUrl, '', publicShareTitleDraft)}
                disabled={!publicShareUrl}
              >
                <IconSend size={15} />
                <span>Mời Nhanh</span>
              </button>
              <button
                type="button"
                className="btn-sm ghost"
                style={{ padding: '8px 14px' }}
                onClick={() => handleCopy(publicShareUrl, 'public')}
                disabled={!publicShareUrl}
              >
                {copiedKey === 'public' ? <><IconCheck size={14} color="#4f7e65" /><span style={{ color: '#4f7e65' }}>Đã copy</span></> : <><IconCopy size={14} /><span>Copy Link</span></>}
              </button>
            </div>
            <div className="share-title-field">
              <label htmlFor="public-share-title">Tiêu đề hiển thị khi gửi link chung</label>
              <input
                id="public-share-title"
                value={publicShareTitleDraft}
                maxLength={160}
                onChange={(e) => {
                  setPublicShareTitleDraft(e.target.value)
                  setShareSettingsMessage('')
                }}
                placeholder="VD: Thiệp cưới Minh Hằng & Đăng Chiến"
              />
              <p>Đây là dòng thay cho “Wedding Invitation - Thiệp Cưới” trên thẻ xem trước.</p>
            </div>
            <div className="share-title-field">
              <label htmlFor="public-share-description">Mô tả hiển thị khi gửi link chung</label>
              <textarea
                id="public-share-description"
                rows={2}
                value={publicShareDescriptionDraft}
                maxLength={300}
                onChange={(e) => {
                  setPublicShareDescriptionDraft(e.target.value)
                  setShareSettingsMessage('')
                }}
                placeholder="VD: Trân trọng kính mời bạn đến chung vui cùng chúng tôi."
              />
            </div>
            <div className="share-settings-inline">
              <button
                type="button"
                className="btn-main"
                onClick={() => saveShareSettings('public')}
                disabled={!currentInvitation || savingShareSettings}
              >
                {savingShareSettings ? 'Đang lưu…' : 'Lưu nội dung chia sẻ'}
              </button>
              {shareSettingsSection === 'public' && shareSettingsMessage && (
                <span className={shareSettingsMessage.startsWith('Đã') ? 'ok' : 'error'}>{shareSettingsMessage}</span>
              )}
            </div>
          </div>
        </section>

        {/* Panel 2: Link cá nhân hoá */}
        <section className="inv-panel">
          <div className="inv-ph">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconUsers size={18} color="#d97757" />
              <div className="inv-pt">Link Cá Nhân Hoá</div>
            </div>
            <div className="inv-ps">Tạo link riêng hiển thị trang trọng tên từng vị khách</div>
          </div>
          <div className="inv-pb">
            <div className="fld">
              <label>Tên khách mời</label>
              <div className="invite-inline-row">
                <input
                  className="invite-inline-input"
                  placeholder="VD: Anh Tuấn, Bạn Linh, Cô Ba…"
                  value={guestName}
                  onChange={(e) => {
                    setGuestName(e.target.value)
                    setGuestLinkVisible(false)
                    setGuestSaveSuccess(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') generateGuestUrl()
                  }}
                />
                <button
                  type="button"
                  className="btn-main invite-create-btn"
                  onClick={generateGuestUrl}
                  disabled={isSavingGuest}
                >
                  <IconSparkles size={14} />
                  <span>{isSavingGuest ? 'Đang lưu…' : 'Tạo Link'}</span>
                </button>
              </div>
            </div>
            <div className="share-title-field">
              <label htmlFor="private-share-title">Tiêu đề hiển thị khi gửi link riêng</label>
              <input
                id="private-share-title"
                value={privateShareTitleDraft}
                maxLength={160}
                onChange={(e) => {
                  setPrivateShareTitleDraft(e.target.value)
                  setShareSettingsMessage('')
                }}
                placeholder={DEFAULT_PRIVATE_SHARE_TITLE}
              />
              <p>Dùng <code>{'{guest_name}'}</code> để tự chèn tên khách. Xem trước: <strong>{privateShareTitle({ extra_data: { share_title_private: privateShareTitleDraft } }, guestName || 'Vân')}</strong></p>
            </div>
            <div className="share-title-field">
              <label htmlFor="private-share-description">Mô tả hiển thị khi gửi link riêng</label>
              <textarea
                id="private-share-description"
                rows={2}
                value={privateShareDescriptionDraft}
                maxLength={300}
                onChange={(e) => {
                  setPrivateShareDescriptionDraft(e.target.value)
                  setShareSettingsMessage('')
                }}
                placeholder={DEFAULT_PRIVATE_SHARE_DESCRIPTION}
              />
              <p>Dùng <code>{'{guest_name}'}</code>. Xem trước: <strong>{privateShareDescription({ extra_data: { share_description_private: privateShareDescriptionDraft } }, guestName || 'Vân')}</strong></p>
            </div>
            {renderPrivateShareImageField()}
            <div className="share-settings-inline">
              <button
                type="button"
                className="btn-main"
                onClick={() => saveShareSettings('private')}
                disabled={!currentInvitation || savingShareSettings}
              >
                {savingShareSettings ? 'Đang lưu…' : 'Lưu nội dung chia sẻ'}
              </button>
              {shareSettingsSection === 'private' && shareSettingsMessage && (
                <span className={shareSettingsMessage.startsWith('Đã') ? 'ok' : 'error'}>{shareSettingsMessage}</span>
              )}
            </div>
            <div className="fld" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <IconClock size={15} color="#d97757" />
                  <span>Thời gian mời tiệc cưới (tuỳ chọn)</span>
                </label>
                <span style={{ fontSize: 12, color: '#777' }}>
                  Giờ mặc định của thiệp: <strong style={{ color: '#d97757' }}>{defaultReceptionTime}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="time"
                  style={{
                    maxWidth: 140,
                    cursor: 'pointer',
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid #d5d9df',
                    fontSize: 14,
                    background: '#fff'
                  }}
                  value={customReceptionTime}
                  onChange={(e) => {
                    setCustomReceptionTime(e.target.value)
                    setGuestLinkVisible(false)
                    setGuestSaveSuccess(false)
                  }}
                />
                {['11:00', '11:30', '17:30', '18:00'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="btn-sm ghost"
                    style={{
                      padding: '6px 11px',
                      fontSize: 12,
                      borderRadius: 6,
                      borderColor: customReceptionTime === preset ? '#d97757' : '#d5d9df',
                      color: customReceptionTime === preset ? '#d97757' : '#495057',
                      background: customReceptionTime === preset ? '#fdf3ef' : '#fff',
                      fontWeight: customReceptionTime === preset ? 600 : 400
                    }}
                    onClick={() => {
                      setCustomReceptionTime(preset)
                      setGuestLinkVisible(false)
                      setGuestSaveSuccess(false)
                    }}
                  >
                    {preset}
                  </button>
                ))}
                {customReceptionTime && (
                  <button
                    type="button"
                    className="btn-sm ghost"
                    style={{ padding: '6px 10px', fontSize: 12, color: '#6c757d', borderRadius: 6 }}
                    onClick={() => {
                      setCustomReceptionTime('')
                      setGuestLinkVisible(false)
                      setGuestSaveSuccess(false)
                    }}
                    title="Khôi phục giờ mặc định"
                  >
                    Dùng mặc định ({defaultReceptionTime})
                  </button>
                )}
              </div>
              <p style={{ margin: '5px 0 0', fontSize: 12, color: '#777', lineHeight: 1.4 }}>
                {customReceptionTime ? (
                  <span>Khách mời này sẽ nhận được giờ mời tiệc riêng là: <strong style={{ color: '#d97757' }}>{customReceptionTime}</strong>.</span>
                ) : (
                  <span>Nếu không chọn giờ riêng, thiệp sẽ hiển thị theo giờ mặc định (<strong style={{ color: '#444' }}>{defaultReceptionTime}</strong>) đã lưu trên thiệp.</span>
                )}
              </p>
            </div>

            <div className="fld" style={{ marginTop: 12 }}>
              <label>Ghi chú mối quan hệ (tuỳ chọn)</label>
              <input
                placeholder="Bạn thân, đồng nghiệp, bạn cấp 3…"
                value={guestNote}
                onChange={(e) => setGuestNote(e.target.value)}
              />
            </div>

            <div className={`gen-box${guestLinkVisible && activeGuestUrl ? ' active' : ''}`}>
              <div className="gen-lbl">Kính gửi vị khách quý:</div>
              <div className="gen-name">{guestName || 'Chưa nhập tên'}</div>
              {guestNoteText ? <div className="gen-note">({guestNoteText})</div> : null}
              <div style={{ marginTop: 6, marginBottom: 6, fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <IconClock size={14} color="#d97757" />
                <span>
                  Giờ mời tiệc:{' '}
                  <strong style={{ color: customReceptionTime ? '#d97757' : '#333' }}>
                    {customReceptionTime ? `${customReceptionTime} (Giờ mời riêng)` : `${defaultReceptionTime} (Mặc định của thiệp)`}
                  </strong>
                </span>
              </div>
              {guestSaveSuccess && (
                <div style={{ color: '#2e7d32', fontSize: 13, fontWeight: 600, margin: '6px 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={15} color="#2e7d32" />
                  <span>Đã lưu thành công vào Danh Sách Khách Mời!</span>
                </div>
              )}
              <div className="gen-url">{activeGuestUrl || 'Link rút gọn độc nhất sẽ xuất hiện ở đây sau khi bạn bấm "Tạo Link".'}</div>
              {guestLinkVisible && activeGuestUrl && (
                <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-quick-invite"
                    onClick={() => openShare(activeGuestUrl, guestName, privateShareTitle({ extra_data: { share_title_private: privateShareTitleDraft } }, guestName))}
                  >
                    <IconSend size={15} />
                    <span>Mời Nhanh</span>
                  </button>
                  <button
                    type="button"
                    className="btn-sm ghost"
                    style={{ padding: '8px 14px' }}
                    onClick={() => handleCopy(activeGuestUrl, 'guest')}
                  >
                    {copiedKey === 'guest' ? (
                      <>
                        <IconCheck size={14} color="#4f7e65" />
                        <span style={{ color: '#4f7e65' }}>Đã copy ✓</span>
                      </>
                    ) : (
                      <>
                        <IconCopy size={14} />
                        <span>Sao chép Link</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {shareImagePickerOpen && currentInvitation && (
        <ImagePickerModal
          slot="share"
          index={null}
          ratio={1.91}
          existingImages={currentInvitation.images || []}
          onSelectExisting={selectPrivateShareImage}
          onUploadNew={uploadPrivateShareImage}
          onClose={() => setShareImagePickerOpen(false)}
        />
      )}

      {/* Share Modal Popup */}
      <QuickShareModal
        isOpen={!!sharePayload}
        onClose={closeShare}
        url={sharePayload?.url}
        recipientName={sharePayload?.name}
        shareTitle={sharePayload?.title}
      />

      {/* Change Slug Modal */}
      {showSlugModal && currentInvitation && (
        <ChangeSlugModal
          isOpen={showSlugModal}
          onClose={() => setShowSlugModal(false)}
          invitation={currentInvitation}
          onSlugChanged={(newSlug) => {
            setInvitations((prev) =>
              prev.map((item) =>
                String(item.id) === String(selectedId)
                  ? { ...item, invitation_slug: newSlug, slug: newSlug }
                  : item
              )
            )
          }}
        />
      )}
    </div>
  )
}

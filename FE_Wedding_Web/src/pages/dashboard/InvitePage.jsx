import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { invitationName, invitationPublicUrl, toArray } from './helpers'
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
import {
  IconSend,
  IconSparkles,
  IconUsers,
  IconCopy,
  IconCheck,
  IconClock,
} from '../../components/Icons'

export default function InvitePage() {
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
  const [savingShareSettings, setSavingShareSettings] = useState(false)
  const [shareSettingsMessage, setShareSettingsMessage] = useState('')

  useEffect(() => {
    const loadInvitations = async () => {
      try {
        const res = await api.getInvitations()
        const data = toArray(res.data)
        setInvitations(data)
        if (data[0]?.id) setSelectedId(String(data[0].id))
      } catch (_err) {
        setInvitations([])
      }
    }
    loadInvitations()
  }, [])



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
  const displayName = currentInvitation ? invitationName(currentInvitation) : ''

  useEffect(() => {
    setPublicShareTitleDraft(publicShareTitle(currentInvitation))
    setPrivateShareTitleDraft(privateShareTitleTemplate(currentInvitation))
    setPublicShareDescriptionDraft(publicShareDescription(currentInvitation))
    setPrivateShareDescriptionDraft(privateShareDescriptionTemplate(currentInvitation))
    setShareSettingsMessage('')
  }, [currentInvitation?.id])

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

  const saveShareSettings = async () => {
    if (!currentInvitation) return
    const publicTitle = publicShareTitleDraft.trim()
    const privateTitle = privateShareTitleDraft.trim()
    const publicDescription = publicShareDescriptionDraft.trim()
    const privateDescription = privateShareDescriptionDraft.trim()
    if (!publicTitle || !privateTitle || !publicDescription || !privateDescription) {
      setShareSettingsMessage('Vui lòng nhập đủ tiêu đề và mô tả chia sẻ.')
      return
    }

    setSavingShareSettings(true)
    setShareSettingsMessage('')
    try {
      const res = await api.setInvitationShareSettings(currentInvitation.id, {
        public_title: publicTitle,
        private_title: privateTitle,
        public_description: publicDescription,
        private_description: privateDescription,
      })
      const updated = res.data?.data || res.data
      setInvitations((prev) => prev.map((item) => (
        String(item.id) === String(currentInvitation.id)
          ? {
              ...item,
              ...updated,
              extra_data: {
                ...(item.extra_data || {}),
                ...(updated?.extra_data || {}),
                share_title_public: publicTitle,
                share_title_private: privateTitle,
                share_description_public: publicDescription,
                share_description_private: privateDescription,
              },
            }
          : item
      )))
      setShareSettingsMessage('Đã lưu. Link gửi mới sẽ dùng tiêu đề này.')
    } catch (err) {
      setShareSettingsMessage(err?.response?.data?.message || err.message || 'Không thể lưu tiêu đề chia sẻ.')
    } finally {
      setSavingShareSettings(false)
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
            <div className="share-btns">
              <button
                type="button"
                className="btn-quick-invite"
                onClick={() => openShare(publicUrl, '', publicShareTitleDraft)}
                disabled={!publicUrl}
              >
                <IconSend size={15} />
                <span>Mời Nhanh</span>
              </button>
              <button
                type="button"
                className="btn-sm ghost"
                style={{ padding: '8px 14px' }}
                onClick={() => handleCopy(publicUrl, 'public')}
                disabled={!publicUrl}
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

      <div className="share-settings-save">
        <button
          type="button"
          className="btn-main"
          onClick={saveShareSettings}
          disabled={!currentInvitation || savingShareSettings}
        >
          {savingShareSettings ? 'Đang lưu…' : 'Lưu tiêu đề chia sẻ'}
        </button>
        {shareSettingsMessage && <span className={shareSettingsMessage.startsWith('Đã') ? 'ok' : 'error'}>{shareSettingsMessage}</span>}
      </div>

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

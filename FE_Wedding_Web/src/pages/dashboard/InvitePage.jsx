import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { invitationName, invitationPublicUrl, toArray } from './helpers'
import QuickShareModal from './QuickShareModal'
import {
  IconSend,
  IconSparkles,
  IconUsers,
  IconCopy,
  IconCheck,
  IconChevronDown,
} from '../../components/Icons'

export default function InvitePage() {
  const selectorRef = useRef(null)
  const copyTimerRef = useRef(null)
  const [invitations, setInvitations] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestNote, setGuestNote] = useState('')
  const [guestLinkVisible, setGuestLinkVisible] = useState(false)
  const [createdUrl, setCreatedUrl] = useState('')
  const [isSavingGuest, setIsSavingGuest] = useState(false)
  const [guestSaveSuccess, setGuestSaveSuccess] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')
  const [sharePayload, setSharePayload] = useState(null)

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
    const handlePointerDown = (event) => {
      if (!selectorRef.current?.contains(event.target)) {
        setSelectorOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    setGuestLinkVisible(false)
    setCreatedUrl('')
    setGuestSaveSuccess(false)
    setCopiedKey('')
    setSharePayload(null)
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    }
  }, [selectedId])

  const currentInvitation = useMemo(
    () => invitations.find((item) => String(item.id) === String(selectedId)),
    [invitations, selectedId],
  )

  const publicUrl = currentInvitation ? invitationPublicUrl(currentInvitation) : ''
  const displayName = currentInvitation ? invitationName(currentInvitation) : ''

  const guestUrl = useMemo(() => {
    if (!publicUrl || !guestName.trim()) return ''
    return `${publicUrl}?guest=${encodeURIComponent(guestName.trim())}`
  }, [publicUrl, guestName])

  const activeGuestUrl = createdUrl || guestUrl
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

  const openShare = (url, name) => {
    if (!url) return
    setSharePayload({ url, name: name || '' })
  }

  const closeShare = () => setSharePayload(null)

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
    try {
      const res = await api.createGuest({
        name: trimmed,
        description: guestNote.trim() || null,
        invitation_id: selectedId,
      })
      const gData = res.data?.data || res.data
      let finalUrl = ''
      if (gData?.privateInvitation?.url) {
        finalUrl = `${window.location.origin}${gData.privateInvitation.url}`
      } else if (publicUrl) {
        finalUrl = `${publicUrl}?guest=${encodeURIComponent(trimmed)}`
      }
      setCreatedUrl(finalUrl)
      setGuestLinkVisible(true)
      setGuestSaveSuccess(true)
    } catch (err) {
      console.error('Lỗi khi lưu khách mời:', err)
      const fallbackUrl = `${publicUrl}?guest=${encodeURIComponent(trimmed)}`
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

      <div className="inv-sel" ref={selectorRef}>
        <span className="inv-sel-lbl">Chọn Thiệp:</span>
        <div className="inv-sel-drop">
          <button
            type="button"
            className={`inv-sel-btn${selectorOpen ? ' open' : ''}`}
            onClick={() => setSelectorOpen((value) => !value)}
          >
            <span className="inv-sel-dot" />
            <span className="isd-name">{displayName || 'Chọn thiệp cưới'}</span>
            <span className="isd-arrow">
              <IconChevronDown size={14} />
            </span>
          </button>
          {selectorOpen ? (
            <div className="isd-menu">
              {invitations.map((inv) => (
                <button
                  type="button"
                  key={inv.id}
                  className={`isd-opt${String(inv.id) === String(selectedId) ? ' active' : ''}`}
                  onClick={() => {
                    setSelectedId(String(inv.id))
                    setSelectorOpen(false)
                  }}
                >
                  <span className="isd-opt-name">{invitationName(inv)}</span>
                  <span className="isd-opt-slug">/{inv.invitation_slug || inv.slug || ''}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
              <button
                type="button"
                className={`btn-copy${copiedKey === 'public' ? ' ok' : ''}`}
                onClick={() => handleCopy(publicUrl, 'public')}
                disabled={!publicUrl}
              >
                {copiedKey === 'public' ? (
                  <>
                    <IconCheck size={13} />
                    <span>Đã copy</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-quick-invite"
                onClick={() => openShare(publicUrl, displayName)}
                disabled={!publicUrl}
              >
                <IconSend size={15} />
                <span>Mời Nhanh</span>
              </button>
              <button
                type="button"
                className="btn-sm ghost"
                style={{ padding: '8px 14px' }}
                onClick={() => handleCopy(publicUrl, 'public-link')}
                disabled={!publicUrl}
              >
                {copiedKey === 'public-link' ? (
                  <>
                    <IconCheck size={14} color="#4f7e65" />
                    <span style={{ color: '#4f7e65' }}>Đã copy</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={14} />
                    <span>Sao chép Link</span>
                  </>
                )}
              </button>
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
              {guestSaveSuccess && (
                <div style={{ color: '#2e7d32', fontSize: 13, fontWeight: 600, margin: '6px 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={15} color="#2e7d32" />
                  <span>Đã lưu thành công vào Danh Sách Khách Mời!</span>
                </div>
              )}
              <div className="gen-url">{activeGuestUrl || 'Link sẽ xuất hiện ở đây sau khi tạo.'}</div>
              {guestLinkVisible && activeGuestUrl && (
                <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-quick-invite"
                    onClick={() => openShare(activeGuestUrl, guestName)}
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

      {/* Share Modal Popup */}
      <QuickShareModal
        isOpen={!!sharePayload}
        onClose={closeShare}
        url={sharePayload?.url}
        recipientName={sharePayload?.name}
      />
    </div>
  )
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { invitationName, invitationPublicUrl, toArray } from './helpers'
import {
  IconSend,
  IconSparkles,
  IconMail,
  IconUsers,
  IconUser,
  IconEdit3,
  IconCopy,
  IconCheck,
  IconShare2,
  IconChevronDown,
  IconX,
  IconRing,
  IconExternalLink,
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
    const run = async () => {
      const res = await api.getInvitations()
      const data = toArray(res.data)
      setInvitations(data)
      if (data[0]?.id) setSelectedId(String(data[0].id))
    }

    run().catch(() => {
      setInvitations([])
      setSelectedId('')
    })
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

  const doShareDirect = async (platform, targetUrl, recipientName) => {
    if (!targetUrl) return
    const nameStr = recipientName ? ` ${recipientName}` : ''
    const message = `💍 Trân trọng kính mời${nameStr} đến tham dự lễ cưới của chúng tôi!\n\nXem thiệp mời tại: ${targetUrl}`

    if (platform === 'copy') {
      await handleCopy(targetUrl, targetUrl)
      return
    }

    if (platform === 'zalo') {
      window.open(`https://zalo.me/share?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      return
    }

    if (platform === 'fb') {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`,
        '_blank',
        'noopener,noreferrer',
      )
      return
    }

    if (platform === 'msg') {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Thiệp cưới', text: message, url: targetUrl })
          return
        } catch (_e) {}
      }
      await handleCopy(message, 'copied-msg')
      window.open('https://m.me', '_blank', 'noopener,noreferrer')
    }
  }

  const doShare = async (platform) => {
    if (!sharePayload?.url) return
    await doShareDirect(platform, sharePayload.url, sharePayload.name)
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
          <div className={`inv-sel-menu${selectorOpen ? ' show' : ''}`}>
            {invitations.map((inv) => {
              const isChosen = String(inv.id) === String(selectedId)
              return (
                <button
                  key={inv.id}
                  type="button"
                  className={`inv-sel-opt${isChosen ? ' chosen' : ''}`}
                  onClick={() => {
                    setSelectedId(String(inv.id))
                    setSelectorOpen(false)
                  }}
                >
                  <span className="iso-dot" />
                  <span className="iso-body">
                    <span className="iso-name">{invitationName(inv)}</span>
                    <span className="iso-date">/{inv.slug || inv.invitation_slug || ''}</span>
                  </span>
                  {isChosen && (
                    <span className="iso-check">
                      <IconCheck size={14} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="inv-layout">
        {/* Panel 1: Link thiệp chung */}
        <section className="inv-panel">
          <div className="inv-ph">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconMail size={18} color="#d97757" />
              <div className="inv-pt">Link Thiệp Chung</div>
            </div>
            <div className="inv-ps">{displayName ? `${displayName} — URL xem công khai` : 'URL xem công khai'}</div>
          </div>
          <div className="inv-pb">
            <div className="url-disp">
              <span>{publicUrl || 'Chưa có link thiệp'}</span>
              <button
                type="button"
                className={`btn-copy${copiedKey === 'public' ? ' ok' : ''}`}
                onClick={() => handleCopy(publicUrl, 'public')}
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
            <div className="share-btns">
              <button type="button" className="shr-btn zalo" onClick={() => doShareDirect('zalo', publicUrl, displayName)}>
                <span>Zalo</span>
              </button>
              <button type="button" className="shr-btn msg" onClick={() => doShareDirect('msg', publicUrl, displayName)}>
                <span>Messenger</span>
              </button>
              <button type="button" className="shr-btn fb" onClick={() => doShareDirect('fb', publicUrl, displayName)}>
                <span>Facebook</span>
              </button>
              <button type="button" className="shr-btn cp" onClick={() => handleCopy(publicUrl, 'public-link')}>
                <IconShare2 size={13} />
                <span>Copy Link Chia Sẻ</span>
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
              <div className="share-btns">
                <button type="button" className="shr-btn zalo" onClick={() => doShareDirect('zalo', activeGuestUrl, guestName)}>
                  <span>Gửi Zalo</span>
                </button>
                <button type="button" className="shr-btn msg" onClick={() => doShareDirect('msg', activeGuestUrl, guestName)}>
                  <span>Messenger</span>
                </button>
                <button type="button" className="shr-btn fb" onClick={() => doShareDirect('fb', activeGuestUrl, guestName)}>
                  <span>Gửi Facebook</span>
                </button>
                <button
                  type="button"
                  className={`shr-btn cp${copiedKey === 'guest' ? ' ok' : ''}`}
                  onClick={() => handleCopy(activeGuestUrl, 'guest')}
                >
                  {copiedKey === 'guest' ? (
                    <>
                      <IconCheck size={13} />
                      <span>Đã copy ✓</span>
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
          </div>
        </section>
      </div>

      {/* Share Modal Popup */}
      <div
        className={`share-ov${sharePayload ? ' show' : ''}`}
        onClick={(event) => event.target === event.currentTarget && closeShare()}
      >
        <div className="share-box">
          <div className="share-hd">
            <button type="button" className="share-x" onClick={closeShare} aria-label="Đóng">
              <IconX size={16} />
            </button>
            <div className="share-ring">
              <IconRing size={28} color="#fff" />
            </div>
            <div className="share-ttl">
              Chia sẻ <em>Thiệp Cưới</em>
            </div>
            <div className="share-guest">{sharePayload?.name ? `— Kính gửi: ${sharePayload.name} —` : ''}</div>
          </div>
          <div className="share-bd">
            <div className="share-grid">
              <button type="button" className="share-item" onClick={() => doShare('zalo')}>
                <div className="share-circle" style={{ background: '#0068ff' }}>
                  Z
                </div>
                <span className="share-lbl">Zalo</span>
              </button>
              <button type="button" className="share-item" onClick={() => doShare('fb')}>
                <div className="share-circle" style={{ background: '#1877f2' }}>
                  f
                </div>
                <span className="share-lbl">Facebook</span>
              </button>
              <button type="button" className="share-item" onClick={() => doShare('msg')}>
                <div className="share-circle" style={{ background: 'linear-gradient(135deg,#0099ff,#a033ff)' }}>
                  M
                </div>
                <span className="share-lbl">Messenger</span>
              </button>
              <button type="button" className="share-item" onClick={() => doShare('copy')}>
                <div className="share-circle share-circle-copy">
                  <IconCopy size={18} />
                </div>
                <span className="share-lbl">Copy</span>
              </button>
            </div>
            <div className="share-copy-row">
              <span className="share-copy-url">{sharePayload?.url || ''}</span>
              <button
                type="button"
                className={`share-copy-btn${copiedKey === 'share' ? ' ok' : ''}`}
                onClick={() => doShare('copy')}
              >
                {copiedKey === 'share' ? 'Đã copy ✓' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

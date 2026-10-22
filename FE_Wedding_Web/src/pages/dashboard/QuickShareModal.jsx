import React, { useState } from 'react'
import { IconCopy, IconCheck, IconX, IconRing } from '../../components/Icons'

export default function QuickShareModal({ isOpen, onClose, url, recipientName }) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !url) return null

  const nameStr = recipientName ? ` ${recipientName}` : ''
  const message = `💍 Trân trọng kính mời${nameStr} đến tham dự lễ cưới của chúng tôi!\n\nXem thiệp mời tại: ${url}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const handleZalo = () => {
    window.open(`https://zalo.me/share?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  const handleMessenger = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Thiệp cưới', text: message, url })
        return
      } catch (_e) {}
    }
    try {
      await navigator.clipboard.writeText(message)
    } catch (_e) {}
    window.open('https://m.me', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="share-ov show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="share-box">
        <div className="share-hd">
          <button type="button" className="share-x" onClick={onClose} aria-label="Đóng">
            <IconX size={16} />
          </button>
          <div className="share-ring">
            <IconRing size={28} color="#fff" />
          </div>
          <div className="share-ttl">
            Mời Nhanh <em>Thiệp Cưới</em>
          </div>
          {recipientName && (
            <div className="share-guest">— Kính gửi: {recipientName} —</div>
          )}
        </div>

        <div className="share-bd">
          <div className="share-grid share-grid-3">
            <button type="button" className="share-item" onClick={handleMessenger} title="Gửi qua Messenger">
              <div className="share-circle" style={{ background: 'linear-gradient(135deg, #0099ff, #a033ff)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.43 3.16 7.17.16.14.26.35.26.57l-.07 1.77c-.03.74.74 1.25 1.41.93l1.98-.95c.18-.09.39-.1.58-.04.85.24 1.74.37 2.68.37 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.06 13.06l-2.54-2.71-4.96 2.71c-.55.3-1.18-.32-.86-.86l5.35-7.51c.32-.45.98-.45 1.3 0l2.54 2.71 4.96-2.71c.55-.3 1.18.32.86.86l-5.35 7.51c-.32.45-.98.45-1.3 0z"/>
                </svg>
              </div>
              <span className="share-lbl">Messenger</span>
            </button>

            <button type="button" className="share-item" onClick={handleZalo} title="Gửi qua Zalo">
              <div className="share-circle" style={{ background: '#0068ff' }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Zalo</span>
              </div>
              <span className="share-lbl">Zalo</span>
            </button>

            <button type="button" className="share-item" onClick={handleCopy} title="Sao chép link mời">
              <div className={`share-circle share-circle-copy${copied ? ' copied-active' : ''}`}>
                {copied ? <IconCheck size={20} color="#2e7d32" /> : <IconCopy size={20} />}
              </div>
              <span className="share-lbl">{copied ? 'Đã chép' : 'Copy link'}</span>
            </button>
          </div>

          <div className="share-copy-row">
            <span className="share-copy-url" title={url}>{url}</span>
            <button
              type="button"
              className="btn-sm rose"
              style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
              onClick={handleCopy}
            >
              {copied ? (
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
        </div>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCopy, IconCheck, IconX, IconRing } from '../../components/Icons'

export default function QuickShareModal({ isOpen, onClose, url, recipientName, shareTitle }) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !url) return null

  const greeting = recipientName
    ? `Trân trọng kính mời ${recipientName}`
    : 'Trân trọng kính mời bạn'
  const message = `💍 ${greeting} đến tham dự lễ cưới của chúng tôi!\n\nXem thiệp mời tại: ${url}`

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
        await navigator.share({ title: shareTitle || 'Thiệp cưới', text: message, url })
        return
      } catch (_e) {}
    }
    try {
      await navigator.clipboard.writeText(message)
    } catch (_e) {}
    window.open('https://m.me', '_blank', 'noopener,noreferrer')
  }

  const modalNode = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 15, 12, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 1000000,
          background: '#ffffff',
          borderRadius: 20,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #ede5db',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          opacity: 1,
          transform: 'none',
          margin: '0 auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
            padding: '24px 20px 20px',
            textAlign: 'center',
            position: 'relative',
            color: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(255, 255, 255, 0.22)',
              border: 'none',
              color: '#ffffff',
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            <IconX size={16} color="#ffffff" />
          </button>

          <div
            style={{
              margin: '0 auto 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconRing size={28} color="#ffffff" />
          </div>

          <div
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 21,
              fontWeight: 600,
              color: '#ffffff',
              lineHeight: 1.2,
            }}
          >
            Mời Nhanh <em style={{ fontStyle: 'italic', color: '#fbeedb' }}>Thiệp Cưới</em>
          </div>

          {recipientName && (
            <div
              style={{
                fontSize: 13.5,
                color: 'rgba(255, 255, 255, 0.95)',
                marginTop: 6,
                fontStyle: 'italic',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              — Kính gửi: {recipientName} —
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '22px 20px 24px', background: '#ffffff' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {/* Messenger */}
            <button
              type="button"
              onClick={handleMessenger}
              title="Gửi qua Messenger"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0099ff, #a033ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 153, 255, 0.35)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.43 3.16 7.17.16.14.26.35.26.57l-.07 1.77c-.03.74.74 1.25 1.41.93l1.98-.95c.18-.09.39-.1.58-.04.85.24 1.74.37 2.68.37 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.06 13.06l-2.54-2.71-4.96 2.71c-.55.3-1.18-.32-.86-.86l5.35-7.51c.32-.45.98-.45 1.3 0l2.54 2.71 4.96-2.71c.55-.3 1.18.32.86.86l-5.35 7.51c-.32.45-.98.45-1.3 0z"/>
                </svg>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#6e625c',
                }}
              >
                Messenger
              </span>
            </button>

            {/* Zalo */}
            <button
              type="button"
              onClick={handleZalo}
              title="Gửi qua Zalo"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#0068ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 104, 255, 0.35)',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 16, color: '#ffffff', letterSpacing: '-0.5px' }}>
                  Zalo
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#6e625c',
                }}
              >
                Zalo
              </span>
            </button>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopy}
              title="Sao chép link mời"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: copied ? '#e8f5e9' : '#f6f1eb',
                  border: copied ? '1px solid #81c784' : '1px solid #ede5db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                  color: copied ? '#2e7d32' : '#6e625c',
                  transition: 'all 0.15s ease',
                }}
              >
                {copied ? <IconCheck size={22} color="#2e7d32" /> : <IconCopy size={20} color="#6e625c" />}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: copied ? '#2e7d32' : '#6e625c',
                }}
              >
                {copied ? 'Đã chép' : 'Copy link'}
              </span>
            </button>
          </div>

          {/* Copy Link Row */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              background: '#f6f1eb',
              border: '1px solid #ede5db',
              borderRadius: 12,
              padding: '6px 6px 6px 14px',
              alignItems: 'center',
            }}
          >
            <span
              title={url}
              style={{
                flex: 1,
                fontSize: 12,
                color: '#6e625c',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
              }}
            >
              {url}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: '8px 14px',
                background: copied ? '#4f7e65' : 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
                transition: 'background 0.2s ease',
              }}
            >
              {copied ? (
                <>
                  <IconCheck size={14} color="#ffffff" />
                  <span>Đã copy</span>
                </>
              ) : (
                <>
                  <IconCopy size={14} color="#ffffff" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode
}

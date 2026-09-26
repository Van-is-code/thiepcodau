import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { IconAlertCircle, IconCheckCircle, IconHelpCircle, IconX } from './Icons'

// Hệ thống popup/modal dùng chung phong cách hiện đại với Line Icons & Glassmorphism
const ModalCtx = createContext(null)

export function ModalProvider({ children }) {
  const [stack, setStack] = useState([])

  const close = useCallback((id, result) => {
    setStack((s) => {
      const item = s.find((x) => x.id === id)
      if (item) item._resolve(result)
      return s.filter((x) => x.id !== id)
    })
  }, [])

  const push = useCallback((cfg) => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2)
      setStack((s) => [...s, { ...cfg, id, _resolve: resolve }])
    })
  }, [])

  const api = useMemo(() => ({
    confirm: (opts) => push({ type: 'confirm', tone: 'default', confirmText: 'Đồng ý', cancelText: 'Huỷ', ...opts }),
    alert: (opts) => push({ type: 'alert', tone: 'default', confirmText: 'Đã hiểu', ...opts }),
  }), [push])

  return (
    <ModalCtx.Provider value={api}>
      {children}
      {stack.map((m, idx) => {
        const toneInfo = TONES[m.tone] || TONES.default
        const ToneIcon = toneInfo.Icon

        return (
          <div
            key={m.id}
            style={{ ...S.overlay, zIndex: 9000 + idx }}
            onClick={(e) => {
              if (e.target === e.currentTarget && m.type === 'alert') close(m.id)
            }}
          >
            <div style={S.box} role="dialog" aria-modal="true">
              <div style={{ ...S.bar, background: toneInfo.color }} />
              <div style={S.body}>
                <div style={S.headerRow}>
                  <div style={{ ...S.iconWrap, background: toneInfo.bg, color: toneInfo.color }}>
                    <ToneIcon size={22} color={toneInfo.color} />
                  </div>
                  <div style={S.titleWrap}>
                    {m.title && <div style={S.title}>{m.title}</div>}
                  </div>
                  <button style={S.closeBtn} onClick={() => close(m.id, false)} aria-label="Đóng">
                    <IconX size={16} />
                  </button>
                </div>
                {m.message && <div style={S.message}>{m.message}</div>}
                {m.content}
              </div>
              <div style={S.actions}>
                {m.type === 'confirm' && (
                  <button style={S.btnGhost} onClick={() => close(m.id, false)}>
                    {m.cancelText}
                  </button>
                )}
                <button
                  style={{ ...S.btnMain, background: toneInfo.gradient || toneInfo.color }}
                  onClick={() => close(m.id, true)}
                  autoFocus
                >
                  {m.confirmText}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </ModalCtx.Provider>
  )
}

export function useModal() {
  const ctx = useContext(ModalCtx)
  if (!ctx) throw new Error('useModal phải nằm trong <ModalProvider>')
  return ctx
}

const TONES = {
  default: {
    color: '#d97757',
    bg: 'rgba(217, 119, 87, 0.12)',
    gradient: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    Icon: IconHelpCircle,
  },
  danger: {
    color: '#c04938',
    bg: 'rgba(192, 73, 56, 0.12)',
    gradient: 'linear-gradient(135deg, #d45948 0%, #a83626 100%)',
    Icon: IconAlertCircle,
  },
  success: {
    color: '#4f7e65',
    bg: 'rgba(79, 126, 101, 0.12)',
    gradient: 'linear-gradient(135deg, #5e967a 0%, #406953 100%)',
    Icon: IconCheckCircle,
  },
  warn: {
    color: '#c9a96e',
    bg: 'rgba(201, 169, 110, 0.15)',
    gradient: 'linear-gradient(135deg, #e3c47e 0%, #c9a96e 100%)',
    Icon: IconAlertCircle,
  },
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26, 20, 18, 0.55)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    animation: 'fadeIn 0.2s ease',
  },
  box: {
    width: 'min(460px, 100%)',
    background: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 25px 60px -10px rgba(26, 20, 18, 0.3)',
    border: '1px solid #ede5db',
    animation: 'slideUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  bar: {
    height: 4,
  },
  body: {
    padding: '24px 26px 8px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: "var(--font-sans)",
    fontSize: 20,
    fontWeight: 700,
    color: '#1f1917',
    lineHeight: 1.2,
  },
  closeBtn: {
    background: '#f6f1eb',
    border: 'none',
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#6e625c',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  message: {
    fontSize: 14,
    lineHeight: 1.65,
    color: '#5c524c',
    whiteSpace: 'pre-line',
    paddingLeft: 2,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '18px 26px 24px',
  },
  btnGhost: {
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 9999,
    cursor: 'pointer',
    border: '1px solid #ede5db',
    background: '#f6f1eb',
    color: '#5c524c',
    transition: 'all 0.2s ease',
  },
  btnMain: {
    padding: '10px 24px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 9999,
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(217, 119, 87, 0.3)',
    transition: 'all 0.2s ease',
  },
}

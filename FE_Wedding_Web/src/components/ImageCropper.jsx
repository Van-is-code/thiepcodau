import React, { useCallback, useEffect, useRef, useState } from 'react'
import { IconCheck, IconX } from './Icons'

// Popup crop ảnh: khách tự kéo/zoom để chọn vùng theo đúng tỉ lệ khung của thiệp,
// không upload thẳng ảnh gốc. Trả về File đã crop qua onDone(file).
// props: file (File), ratio (số w/h, vd 0.75 = 3:4; null = vuông 1:1), onDone, onCancel
export default function ImageCropper({ file, ratio, onDone, onCancel, queueLabel }) {
  const r = ratio && ratio > 0 ? ratio : 1
  const VP_W = 320
  const VP_H = Math.round(VP_W / r)

  const [url, setUrl] = useState('')
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const drag = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const baseScale = nat.w ? Math.max(VP_W / nat.w, VP_H / nat.h) : 1
  const dispW = nat.w * baseScale * zoom
  const dispH = nat.h * baseScale * zoom
  const maxPanX = Math.max((dispW - VP_W) / 2, 0)
  const maxPanY = Math.max((dispH - VP_H) / 2, 0)

  const clampPan = useCallback((p) => ({
    x: Math.max(-maxPanX, Math.min(maxPanX, p.x)),
    y: Math.max(-maxPanY, Math.min(maxPanY, p.y)),
  }), [maxPanX, maxPanY])

  useEffect(() => { setPan((p) => clampPan(p)) }, [zoom, clampPan])

  const onImgLoad = (e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })

  const onPointerDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    setPan(clampPan({ x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) }))
  }
  const onPointerUp = () => { drag.current = null }

  const doCrop = async () => {
    const img = imgRef.current
    if (!nat.w || !img) { onDone(file); return }
    setBusy(true)
    try {
      const scale = baseScale * zoom
      const srcW = VP_W / scale
      const srcH = VP_H / scale
      let srcX = (dispW / 2 - VP_W / 2 - pan.x) / scale
      let srcY = (dispH / 2 - VP_H / 2 - pan.y) / scale
      srcX = Math.max(0, Math.min(srcX, nat.w - srcW))
      srcY = Math.max(0, Math.min(srcY, nat.h - srcH))

      const OUT_W = Math.min(Math.round(srcW), 1400)
      const OUT_H = Math.round(OUT_W / r)
      const canvas = document.createElement('canvas')
      canvas.width = OUT_W
      canvas.height = OUT_H
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUT_W, OUT_H)

      const isPng = /png$/i.test(file.type)
      const blob = await new Promise((res) => canvas.toBlob(res, isPng ? 'image/png' : 'image/jpeg', 0.92))
      if (!blob) { onDone(file); return }
      const out = new File([blob], file.name.replace(/\.\w+$/, '') + (isPng ? '.png' : '.jpg'), { type: blob.type })
      onDone(out)
    } catch (e) {
      console.error('crop failed, dùng ảnh gốc:', e)
      onDone(file)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={S.box}>
        <div style={S.head}>
          <div>
            <div style={S.title}>
              Cắt ảnh cho vừa khung
              {queueLabel ? <span style={S.queueTag}>{queueLabel}</span> : null}
            </div>
            <div style={S.sub}>Kéo để di chuyển, thanh trượt để phóng to. Tỉ lệ khung: {formatRatio(r)}</div>
          </div>
          <button style={S.close} onClick={onCancel}><IconX size={18} /></button>
        </div>

        <div style={S.stage}>
          <div
            style={{ ...S.viewport, width: VP_W, height: VP_H, cursor: drag.current ? 'grabbing' : 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {url && (
              <img
                ref={imgRef}
                src={url}
                alt=""
                draggable={false}
                onLoad={onImgLoad}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: dispW || 'auto',
                  height: dispH || 'auto',
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                  userSelect: 'none',
                  maxWidth: 'none',
                }}
              />
            )}
            <div style={S.grid} />
          </div>
        </div>

        <div style={S.zoomRow}>
          <span style={{ fontSize: 12, color: '#6e625c' }}>Phóng to</span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
        </div>

        <div style={S.actions}>
          <button style={S.btnGhost} onClick={() => onDone(file)}>Dùng ảnh gốc</button>
          <button style={S.btnMain} onClick={doCrop} disabled={busy || !nat.w}>
            <IconCheck size={15} /> {busy ? 'Đang cắt…' : 'Cắt & dùng ảnh này'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatRatio(r) {
  const known = { 1: '1:1', 0.75: '3:4', 1.333: '4:3', 0.5625: '9:16', 1.777: '16:9', 0.667: '2:3', 1.5: '3:2' }
  const hit = Object.keys(known).find((k) => Math.abs(Number(k) - r) < 0.03)
  return hit ? known[hit] : r.toFixed(2)
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(31,25,23,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9500, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  box: { width: 'min(420px, 100%)', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '18px 20px 12px', borderBottom: '1px solid #ede5db' },
  title: { fontSize: 15.5, fontWeight: 700, color: '#1f1917', display: 'flex', alignItems: 'center', gap: 8 },
  queueTag: { fontSize: 11, fontWeight: 700, color: '#fff', background: '#c96547', borderRadius: 999, padding: '2px 8px' },
  sub: { fontSize: 11.5, color: '#6e625c', marginTop: 4, lineHeight: 1.5 },
  close: { background: '#f6f1eb', border: '1px solid #ede5db', borderRadius: 9, padding: 7, cursor: 'pointer', color: '#6e625c', display: 'flex', flexShrink: 0 },
  stage: { display: 'flex', justifyContent: 'center', padding: '18px 20px 8px', background: '#faf6f0' },
  viewport: { position: 'relative', overflow: 'hidden', borderRadius: 10, background: '#000', touchAction: 'none', boxShadow: '0 0 0 1px #ede5db' },
  grid: { position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)', backgroundSize: '33.33% 33.33%' },
  zoomRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px 6px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px 18px' },
  btnGhost: { padding: '9px 16px', fontSize: 12.5, borderRadius: 9, border: '1px solid #d8ccbe', background: '#f5ede0', color: '#2c2420', cursor: 'pointer' },
  btnMain: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)', color: '#fff', cursor: 'pointer' },
}

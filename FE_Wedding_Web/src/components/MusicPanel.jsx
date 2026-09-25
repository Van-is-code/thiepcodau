import React, { useEffect, useRef, useState } from 'react'
import { api, API_BASE } from '../api'
import { IconMusic, IconX, IconPlus, IconTrash2, IconCheck, IconUploadCloud } from './Icons'

// Nhạc nền cho thiệp: khách tự dán 1 hoặc nhiều link, hoặc chọn từ kho nhạc hệ thống.
// Để trống -> hệ thống tự dùng 1 bài ngẫu nhiên trong kho.
export default function MusicPanel({ invitation, onSaved, onClose }) {
  const initPlaylist = () => {
    const pl = invitation?.extra_data?.music_playlist
    if (Array.isArray(pl) && pl.length) return pl.map((u) => ({ url: u, title: fileName(u) }))
    if (invitation?.music_url) return [{ url: invitation.music_url, title: fileName(invitation.music_url) }]
    return []
  }
  const [list, setList] = useState(initPlaylist)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [lib, setLib] = useState([])
  const [showLib, setShowLib] = useState(false)
  const [status, setStatus] = useState('idle')
  const [err, setErr] = useState('')
  const [dangTai, setDangTai] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    api.listMusicLibrary().then((r) => setLib(r.data?.data || r.data || [])).catch(() => {})
  }, [])

  const add = (url, title) => {
    url = String(url || '').trim()
    if (!/^(https?:\/\/|\/media\/|\/uploads\/)/i.test(url)) { setErr('Link nhạc phải bắt đầu bằng http(s):// hoặc /media/'); return }
    if (list.some((x) => x.url === url)) return
    setErr('')
    setList((l) => [...l, { url, title: title || fileName(url) }])
  }

  // Nhạc RIÊNG của khách: tải thẳng lên máy chủ, không vào kho chung, không ai
  // khác thấy. Tệp nằm ở /uploads/music/<tài khoản>/ và máy chủ chỉ cho chính chủ
  // thiệp gắn vào.
  const taiNhacRieng = async (file) => {
    if (!file) return
    setDangTai(true); setErr('')
    try {
      const r = await api.uploadOwnMusic(invitation.id, file)
      const d = r.data?.data || r.data
      const url = d?.music_url || d?.url
      if (!url) throw new Error('Máy chủ không trả về đường dẫn nhạc')
      add(url, file.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Tải nhạc lên thất bại')
    } finally {
      setDangTai(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    setStatus('saving'); setErr('')
    try {
      const res = await api.setInvitationMusic(invitation.id, list.map((x) => x.url))
      const data = res.data?.data || res.data
      setStatus('saved')
      onSaved && onSaved(data)
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Lưu nhạc thất bại')
      setStatus('error')
    }
  }

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.box}>
        <div style={S.head}>
          <div>
            <div style={S.title}><IconMusic size={17} color="#d97757" /> Nhạc nền thiệp cưới</div>
            <div style={S.sub}>Dán link nhạc của bạn (có thể nhiều bài) hoặc chọn từ kho nhạc. Để trống = hệ thống tự chọn.</div>
          </div>
          <button style={S.close} onClick={onClose}><IconX size={18} /></button>
        </div>

        <div style={S.body}>
          {list.length === 0 && <div style={S.empty}>Chưa có nhạc — sẽ dùng 1 bài ngẫu nhiên từ kho hệ thống.</div>}
          {list.map((t, i) => (
            <div key={t.url} style={S.track}>
              <span style={S.trackIdx}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.trackTitle}>{t.title}</div>
                <audio controls preload="none" src={audioSrc(t.url)} style={{ width: '100%', height: 30, marginTop: 4 }} />
              </div>
              <button style={S.trackDel} onClick={() => setList((l) => l.filter((x) => x.url !== t.url))}>
                <IconTrash2 size={13} />
              </button>
            </div>
          ))}

          <div style={S.addRow}>
            <input ref={fileRef} type="file" style={{ display: 'none' }}
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm"
              onChange={(e) => taiNhacRieng(e.target.files?.[0] || null)} />
            <button style={S.btnAdd} onClick={() => fileRef.current?.click()} disabled={dangTai}>
              <IconUploadCloud size={14} /> {dangTai ? 'Đang tải lên…' : 'Tải nhạc của bạn'}
            </button>
          </div>

          <div style={S.addRow}>
            <input style={S.input} placeholder="Dán link nhạc (mp3)…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <input style={{ ...S.input, width: 130 }} placeholder="Tên (tuỳ chọn)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
            <button style={S.btnAdd} onClick={() => { add(linkUrl, linkTitle); setLinkUrl(''); setLinkTitle('') }}>
              <IconPlus size={14} /> Thêm
            </button>
          </div>

          <button style={S.libToggle} onClick={() => setShowLib((v) => !v)}>
            {showLib ? '▾' : '▸'} Chọn từ kho nhạc hệ thống ({lib.length})
          </button>
          {showLib && (
            <div style={S.lib}>
              {lib.length === 0 && <div style={S.empty}>Kho nhạc trống. Admin thêm nhạc ở trang /admin → Kho Nhạc.</div>}
              {lib.map((t) => (
                <button key={t.id} style={S.libItem} onClick={() => add(t.url, t.title)}>
                  <IconMusic size={12} /> <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                  <span style={{ fontSize: 10, color: '#9e918a' }}>{t.source === 'file' ? 'file' : 'link'}</span>
                </button>
              ))}
            </div>
          )}

          {err && <div style={S.err}>⚠ {err}</div>}
        </div>

        <div style={S.actions}>
          <span style={{ fontSize: 12, color: status === 'saved' ? '#4f7e65' : '#6e625c' }}>
            {status === 'saved' ? '✓ Đã lưu nhạc' : status === 'saving' ? 'Đang lưu…' : ''}
          </span>
          <button style={S.btnMain} onClick={save} disabled={status === 'saving'}>
            <IconCheck size={15} /> Lưu nhạc (không tính lượt sửa)
          </button>
        </div>
      </div>
    </div>
  )
}

function fileName(u) {
  try { return decodeURIComponent(String(u).split('/').pop().split('?')[0]) || 'Nhạc nền' } catch { return 'Nhạc nền' }
}
function audioSrc(u) {
  if (/^https?:\/\//i.test(u)) return u
  return API_BASE + (u.startsWith('/') ? u : '/' + u)
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(31,25,23,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9400, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  box: { width: 'min(520px, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '18px 20px 12px', borderBottom: '1px solid #ede5db' },
  title: { fontSize: 15.5, fontWeight: 700, color: '#1f1917', display: 'flex', alignItems: 'center', gap: 7 },
  sub: { fontSize: 11.5, color: '#6e625c', marginTop: 4, lineHeight: 1.5 },
  close: { background: '#f6f1eb', border: '1px solid #ede5db', borderRadius: 9, padding: 7, cursor: 'pointer', color: '#6e625c', display: 'flex', flexShrink: 0 },
  body: { padding: '14px 20px', overflowY: 'auto', flex: 1 },
  empty: { fontSize: 12, color: '#6e625c', padding: '10px 0', fontStyle: 'italic' },
  track: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px dashed #ede5db' },
  trackIdx: { width: 20, height: 20, borderRadius: 6, background: '#f6f1eb', color: '#9e918a', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  trackTitle: { fontSize: 12.5, color: '#1f1917', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  trackDel: { background: '#fbeeec', border: '1px solid #e3b7b1', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#b5443a', display: 'flex', flexShrink: 0 },
  addRow: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 120, height: 36, padding: '0 10px', border: '1px solid #d8ccbe', borderRadius: 8, fontSize: 12.5, background: '#fcfaf7' },
  btnAdd: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 14px', height: 36, fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: '1px solid #ede5db', background: '#f6f1eb', color: '#1f1917', cursor: 'pointer' },
  libToggle: { marginTop: 14, background: 'none', border: 'none', color: '#c96547', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 },
  lib: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' },
  libItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #ede5db', background: '#fcfaf7', color: '#1f1917', cursor: 'pointer' },
  err: { marginTop: 10, fontSize: 12, color: '#b5443a' },
  actions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '12px 20px 16px', borderTop: '1px solid #ede5db' },
  btnMain: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)', color: '#fff', cursor: 'pointer' },
}

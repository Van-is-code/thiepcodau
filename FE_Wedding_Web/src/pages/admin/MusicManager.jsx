import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { useModal } from '../../components/Modal'
import { IconPlus, IconTrash2, IconSearch } from '../../components/Icons'
import { API_BASE } from '../../api'

// Quản lý kho nhạc: thêm bài (tệp hoặc link), đặt chung hay riêng cho 1 khách,
// bật/tắt, và xoá.
//
// TẮT khác XOÁ, và khác biệt này quan trọng: tắt chỉ ẩn bài khỏi danh sách chọn,
// thiệp cũ đang dùng vẫn phát bình thường. Xoá mới gỡ tệp — thiệp cũ mất nhạc và
// không khôi phục được. Nên nút xoá luôn hỏi số thiệp đang dùng trước.
const VIS = {
  public: { nhan: 'Chung', mo: 'Mọi khách chọn được', mau: '#2f7d5d', nen: '#e8f5ee' },
  exclusive: { nhan: 'Riêng', mo: 'Chỉ đúng 1 khách hàng', mau: '#8a3a3a', nen: '#fbe9e9' },
}

const dungLuong = (b) => (b == null ? '—' : `${Math.round(b / 1024 / 1024 * 10) / 10} MB`)
const loi = (e) => e?.response?.data?.message || e.message || 'Đã có lỗi'

export default function MusicManager() {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [locTrangThai, setLocTrangThai] = useState('')
  const [err, setErr] = useState('')
  const [them, setThem] = useState(false)

  const load = useCallback(() => {
    api.admin.listMusicAdmin({ search: q || undefined, status: locTrangThai || undefined })
      .then((r) => setRows(r.data?.data || r.data || []))
      .catch((e) => setErr(loi(e)))
  }, [q, locTrangThai])
  useEffect(() => { load() }, [load])

  const doiTrangThai = async (t) => {
    const bat = t.status !== 'active'
    try {
      await api.admin.updateMusicTrack(t.id, { status: bat ? 'active' : 'disabled' })
      load()
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: loi(e) }) }
  }

  const xoa = async (t) => {
    let dangDung = 0
    try {
      const r = await api.admin.musicTrackUsage(t.id)
      dangDung = (r.data?.data || r.data)?.usage || 0
    } catch (_e) { /* đếm không được thì vẫn hỏi, chỉ là không có con số */ }

    const ok = await modal.confirm({
      tone: 'danger',
      title: `Xoá "${t.title}"?`,
      message: dangDung > 0
        ? `Đang có ${dangDung} thiệp dùng bài này. Xoá là các thiệp đó MẤT NHẠC và không khôi phục được.\n\n`
          + 'Nếu chỉ muốn ngừng cho khách chọn thì hãy TẮT bài thay vì xoá.'
        : 'Chưa có thiệp nào dùng bài này. Xoá sẽ gỡ luôn tệp khỏi máy chủ.',
      confirmText: dangDung > 0 ? 'Vẫn xoá' : 'Xoá',
    })
    if (!ok) return
    try {
      await api.admin.removeMusicTrack(t.id, dangDung > 0)
      load()
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: loi(e) }) }
  }

  const doiMucDung = async (t, vis) => {
    let chu = t.owner_customer_id
    if (vis === 'exclusive') {
      chu = window.prompt('Dán ID khách hàng được dùng riêng bài này:', chu || '')
      if (!chu) return
    }
    try {
      await api.admin.updateMusicTrack(t.id, { visibility: vis, owner_customer_id: vis === 'exclusive' ? chu : null })
      load()
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: loi(e) }) }
  }

  const urlDayDu = (u) => (/^https?:\/\//i.test(u) ? u : `${API_BASE}${u}`)

  return (
    <>
      <div style={S.toolbar}>
        <div style={S.searchBox}>
          <IconSearch size={15} color="#9a8f88" />
          <input style={S.searchInput} placeholder="Tìm bài hát" value={q}
            onChange={(e) => setQ(e.target.value)} />
        </div>
        <select style={S.select} value={locTrangThai} onChange={(e) => setLocTrangThai(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="active">Đang bật</option>
          <option value="disabled">Đã tắt</option>
        </select>
        <span style={{ flex: 1 }} />
        <button style={S.btnMain} onClick={() => setThem((v) => !v)}>
          <IconPlus size={14} /> Thêm nhạc
        </button>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}
      {them && <FormThem onDone={() => { setThem(false); load() }} onCancel={() => setThem(false)} />}

      <div style={S.note}>
        <b>Tắt</b> chỉ ẩn bài khỏi danh sách cho khách chọn — thiệp cũ đang dùng vẫn phát bình thường.
        <b> Xoá</b> mới gỡ tệp khỏi máy chủ, thiệp cũ sẽ mất nhạc.
      </div>

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <Th>Bài hát</Th><Th>Nguồn</Th><Th>Dung lượng</Th><Th>Ai được dùng</Th><Th>Trạng thái</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const v = VIS[t.visibility] || VIS.public
              const tat = t.status !== 'active'
              return (
                <tr key={t.id} style={tat ? { opacity: 0.55 } : null}>
                  <Td>
                    <b>{t.title}</b>
                    {t.artist && <div style={S.tiny}>{t.artist}</div>}
                    {/* preload="none" — 60 bài mà nạp sẵn hết là ngốn băng thông vô ích. */}
                    <audio controls preload="none" src={urlDayDu(t.url)}
                      style={{ height: 30, marginTop: 5, maxWidth: 230 }} />
                  </Td>
                  <Td>{t.source === 'file' ? 'Tệp trên máy chủ' : 'Link ngoài'}</Td>
                  <Td>{dungLuong(t.bytes)}</Td>
                  <Td>
                    <span style={{ ...S.pill, color: v.mau, background: v.nen }}>{v.nhan}</span>
                    {t.visibility === 'exclusive' && (
                      <div style={S.tiny}>{t.owner_customer_name || t.owner_customer_id}</div>
                    )}
                  </Td>
                  <Td>
                    <button style={S.mini} onClick={() => doiTrangThai(t)}>
                      {tat ? 'Đang tắt — bật lên' : 'Đang bật — tắt đi'}
                    </button>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                      <button style={S.mini}
                        onClick={() => doiMucDung(t, t.visibility === 'public' ? 'exclusive' : 'public')}>
                        {t.visibility === 'public' ? 'Chuyển riêng' : 'Chuyển chung'}
                      </button>
                      {!String(t.id).startsWith('folder:') && (
                        <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => xoa(t)}>
                          <IconTrash2 size={12} /> Xoá
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><Td colSpan={6}><span style={S.tiny}>Kho nhạc trống. Bấm "Thêm nhạc" để bắt đầu.</span></Td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ---------------- Form thêm bài ---------------- */
function FormThem({ onDone, onCancel }) {
  const modal = useModal()
  const fileRef = useRef(null)
  const [kieu, setKieu] = useState('file')   // file | link
  const [file, setFile] = useState(null)
  const [f, setF] = useState({ title: '', artist: '', url: '', visibility: 'public', owner_customer_id: '' })
  const [busy, setBusy] = useState(false)

  const chon = (x) => {
    setFile(x)
    if (x && !f.title) setF((s) => ({ ...s, title: x.name.replace(/\.[^.]+$/, '') }))
  }

  const luu = async () => {
    if (f.visibility === 'exclusive' && !f.owner_customer_id.trim()) {
      await modal.alert({ tone: 'warn', title: 'Thiếu khách hàng', message: 'Bài riêng phải nhập ID khách hàng.' })
      return
    }
    setBusy(true)
    try {
      if (kieu === 'file') {
        if (!file) throw new Error('Chưa chọn tệp nhạc')
        const fd = new FormData()
        fd.append('file', file)
        fd.append('title', f.title || file.name)
        if (f.artist) fd.append('artist', f.artist)
        fd.append('visibility', f.visibility)
        if (f.visibility === 'exclusive') fd.append('owner_customer_id', f.owner_customer_id.trim())
        await api.admin.addMusicTrack(fd)
      } else {
        await api.admin.addMusicTrack({
          title: f.title, artist: f.artist || undefined, url: f.url,
          visibility: f.visibility,
          owner_customer_id: f.visibility === 'exclusive' ? f.owner_customer_id.trim() : null,
        })
      }
      onDone()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Thêm nhạc thất bại', message: loi(e) })
    } finally { setBusy(false) }
  }

  return (
    <div style={S.panel}>
      <div style={S.row}>
        {[['file', 'Tải tệp lên'], ['link', 'Dán link ngoài']].map(([k, nhan]) => (
          <button key={k} onClick={() => setKieu(k)}
            style={{ ...S.chip, ...(kieu === k ? S.chipOn : null) }}>{nhan}</button>
        ))}
      </div>

      {kieu === 'file' ? (
        <div style={{ ...S.row, marginTop: 10 }}>
          <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm"
            style={{ display: 'none' }} onChange={(e) => chon(e.target.files?.[0] || null)} />
          <button style={S.btnGhost} onClick={() => fileRef.current?.click()}>
            {file ? 'Đổi tệp khác' : 'Chọn tệp nhạc'}
          </button>
          {file && <span style={S.tiny}>{file.name} · {dungLuong(file.size)}</span>}
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <F l="Link nhạc (http/https)">
            <input style={S.input} value={f.url} placeholder="https://..."
              onChange={(e) => setF({ ...f, url: e.target.value })} />
          </F>
        </div>
      )}

      <div style={{ ...S.formGrid, marginTop: 10 }}>
        <F l="Tên bài hát"><input style={S.input} value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })} /></F>
        <F l="Ca sĩ / ghi chú"><input style={S.input} value={f.artist}
          onChange={(e) => setF({ ...f, artist: e.target.value })} /></F>
        <F l="Ai được dùng">
          <select style={S.input} value={f.visibility}
            onChange={(e) => setF({ ...f, visibility: e.target.value })}>
            <option value="public">Chung — mọi khách chọn được</option>
            <option value="exclusive">Riêng — chỉ 1 khách hàng</option>
          </select>
        </F>
        {f.visibility === 'exclusive' && (
          <F l="ID khách hàng"><input style={S.input} value={f.owner_customer_id}
            onChange={(e) => setF({ ...f, owner_customer_id: e.target.value })} /></F>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={S.btnMain} onClick={luu} disabled={busy}>{busy ? 'Đang lưu…' : 'Thêm vào kho'}</button>
        <button style={S.btnGhost} onClick={onCancel}>Huỷ</button>
      </div>
      <p style={S.tiny}>
        Nhận MP3, WAV, OGG, M4A, FLAC, WebM. Tệp lưu ở <code>media/music/</code> trên máy chủ.
      </p>
    </div>
  )
}

const Th = ({ children }) => <th style={S.th}>{children}</th>
const Td = ({ children, colSpan }) => <td style={S.td} colSpan={colSpan}>{children}</td>
const F = ({ l, children }) => (
  <label style={{ display: 'block' }}>
    <div style={S.label}>{l}</div>
    {children}
  </label>
)

const S = {
  toolbar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px',
    border: '1px solid #ede5db', borderRadius: 9, background: '#fff',
  },
  searchInput: { border: 'none', outline: 'none', fontSize: 13.5, fontFamily: 'inherit', width: 170, color: '#1f1917' },
  select: {
    padding: '8px 10px', border: '1px solid #ede5db', borderRadius: 9, fontSize: 13,
    fontFamily: 'inherit', background: '#fff', color: '#1f1917',
  },
  input: {
    width: '100%', padding: '8px 11px', border: '1px solid #ede5db', borderRadius: 9,
    fontSize: 13.5, fontFamily: 'inherit', background: '#fff', color: '#1f1917', boxSizing: 'border-box',
  },
  label: { fontSize: 12, color: '#8a8078', marginBottom: 4 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },

  btnMain: {
    padding: '9px 16px', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13.5,
    fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#e58d6f,#c96547)',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
  },
  btnGhost: {
    padding: '9px 15px', border: '1px solid #ede5db', borderRadius: 9, cursor: 'pointer',
    fontSize: 13.5, background: '#f6f1eb', color: '#1f1917', fontFamily: 'inherit',
  },
  mini: {
    padding: '4px 10px', border: '1px solid #ede5db', borderRadius: 7, cursor: 'pointer',
    fontSize: 12, background: '#fff', color: '#1f1917', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  miniDanger: { color: '#c04938', borderColor: '#f0d5d0', background: '#fdf3f1' },
  chip: {
    padding: '6px 13px', border: '1px solid #ede5db', borderRadius: 20, cursor: 'pointer',
    fontSize: 12.5, background: '#fff', color: '#6e625c', fontFamily: 'inherit',
  },
  chipOn: { background: '#fdf1ec', borderColor: '#e8bdaa', color: '#c96547', fontWeight: 600 },
  pill: { display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 },

  panel: { background: '#fff', border: '1px solid #ede5db', borderRadius: 13, padding: 15, marginBottom: 14 },
  note: {
    background: '#fbf7f2', border: '1px solid #f0e6da', borderRadius: 10,
    padding: '9px 13px', fontSize: 12.5, color: '#6e625c', lineHeight: 1.6, marginBottom: 12,
  },
  err: {
    background: '#fdf3f1', border: '1px solid #f0d5d0', color: '#c04938',
    borderRadius: 10, padding: '9px 13px', fontSize: 13, marginBottom: 12,
  },
  tableWrap: { background: '#fff', border: '1px solid #ede5db', borderRadius: 13, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 13px', fontSize: 11.5, fontWeight: 600, color: '#8a8078',
    textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #f0e8de', whiteSpace: 'nowrap',
  },
  td: { padding: '11px 13px', borderBottom: '1px solid #f6f1eb', verticalAlign: 'top' },
  tiny: { fontSize: 11.5, color: '#8a8078', lineHeight: 1.5 },
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { useModal } from '../../components/Modal'
import TemplateFieldPicker from './TemplateFieldPicker'
import { resolveTemplateUrl } from '../../lib/templateEngine'

// Nhãn tiếng Việt cho các mức hiển thị.
const VISIBILITY = {
  public: { label: 'Công khai', hint: 'Mọi CTV và khách đều chọn được', color: '#2f7d5d', bg: '#e8f5ee' },
  restricted: { label: 'Giới hạn', hint: 'Chỉ ai được cấp quyền', color: '#8a6d1f', bg: '#fbf3dd' },
  exclusive: { label: 'Độc quyền', hint: 'Riêng đúng 1 khách hàng', color: '#8a3a3a', bg: '#fbe9e9' },
}

const GRANTEE = {
  ctv: 'Cộng tác viên',
  customer: 'Khách hàng',
  user: 'Tài khoản',
}

const errText = (e) => e?.response?.data?.message || e.message || 'Đã có lỗi xảy ra'

/* =======================================================================
   Bảng danh sách mẫu
   ======================================================================= */
export default function TemplateManager() {
  const modal = useModal()
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.admin.listManagedTemplates(search ? { search } : {})
      setRows(r.data?.data?.items || [])
      setErr('')
    } catch (e) {
      setErr(errText(e))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  // Bật/tắt mẫu: 'published' = khách chọn được, 'draft' = ẩn khỏi mọi người trừ admin.
  const toggleStatus = async (t) => {
    const next = t.status === 'published' ? 'draft' : 'published'
    if (next === 'draft' && t.invitation_count > 0) {
      const ok = await modal.confirm({
        tone: 'danger',
        title: 'Tắt mẫu đang được dùng',
        message: `Mẫu này đang có ${t.invitation_count} thiệp sử dụng. Tắt đi thì khách KHÔNG chọn mới được nữa, `
          + 'nhưng các thiệp đã tạo vẫn hiển thị bình thường. Tiếp tục?',
        confirmText: 'Tắt mẫu',
      })
      if (!ok) return
    }
    try {
      await api.admin.updateManagedTemplate(t.id, { status: next })
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Lỗi', message: errText(e) })
    }
  }

  // Xoá mẫu: chỉ khi chưa có thiệp nào dùng. Backend là nơi chốt chặn thật; ở đây
  // chặn sớm để khỏi bắt người dùng bấm rồi mới báo lỗi.
  const del = async (t) => {
    if (t.invitation_count > 0) {
      await modal.alert({
        tone: 'danger',
        title: 'Không thể xoá mẫu này',
        message: `Đang có ${t.invitation_count} thiệp dùng mẫu này. Xoá đi thì những thiệp đó mất giao diện `
          + 'và khách mở link chỉ thấy trang lỗi. Hãy TẮT mẫu thay vì xoá: thiệp cũ vẫn hiển thị '
          + 'bình thường, chỉ không ai chọn mới được nữa.',
      })
      return
    }
    const ok = await modal.confirm({
      tone: 'danger',
      title: 'Xoá mẫu thiệp',
      message: `Xoá hẳn mẫu "${t.template_name}" và toàn bộ tệp giao diện của nó? Không khôi phục được.`,
      confirmText: 'Xoá mẫu',
    })
    if (!ok) return
    try {
      await api.admin.deleteManagedTemplate(t.id)
      load()
    } catch (e) {
      await modal.alert({ tone: 'danger', title: 'Không xoá được', message: errText(e) })
    }
  }

  return (
    <div>
      <div style={S.toolbar}>
        <input
          style={S.search}
          placeholder="Tìm theo tên hoặc mã mẫu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button style={S.primary} onClick={() => setShowImport(true)}>+ Nhập theme mới</button>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}
      {loading && <div style={S.muted}>Đang tải...</div>}

      {!loading && rows.length === 0 && (
        <div style={S.empty}>
          Chưa có mẫu nào. Bấm <strong>Nhập theme mới</strong> rồi chọn file .zip của thư mục theme —
          hệ thống tự gắn các ô dữ liệu và tạo mẫu.
        </div>
      )}

      <div style={S.grid}>
        {rows.map((t) => (
          <TemplateCard
            key={t.id}
            t={t}
            onToggle={() => toggleStatus(t)}
            onOpen={() => setOpenId(t.id)}
            onDelete={() => del(t)}
          />
        ))}
      </div>

      {showImport && <ImportDialog onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load() }} />}
      {openId && <DetailDialog id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

/* ---------------- Thẻ 1 mẫu ---------------- */
function TemplateCard({ t, onToggle, onOpen, onDelete }) {
  const vis = VISIBILITY[t.visibility] || VISIBILITY.public
  const on = t.status === 'published'
  return (
    <div style={S.card}>
      <div style={S.cardTop}>
        <div style={{ minWidth: 0 }}>
          <div style={S.cardName} title={t.template_name}>{t.template_name}</div>
          <code style={S.code}>{t.template_code}</code>
        </div>
        <span style={{ ...S.pill, color: vis.color, background: vis.bg }} title={vis.hint}>{vis.label}</span>
      </div>

      {t.description && <div style={S.cardDesc}>{t.description}</div>}

      <div style={S.cardMeta}>
        {t.manifest_summary && (
          <span title="Số ô dữ liệu mẫu hỗ trợ">
            {t.manifest_summary.fields} trường · {t.manifest_summary.image_slots} loại ô ảnh
          </span>
        )}
        <span>{t.invitation_count} thiệp đang dùng</span>
        {t.grant_count > 0 && <span>{t.grant_count} quyền đã cấp</span>}
      </div>

      {t.visibility === 'exclusive' && t.owner_customer_name && (
        <div style={S.exclusiveNote}>Riêng của: <strong>{t.owner_customer_name}</strong></div>
      )}

      {t.manifest_summary?.needs_review > 0 && (
        <div style={S.reviewNote}>
          ⚠ {t.manifest_summary.needs_review} ô hệ thống không dám tự đoán — mở chi tiết để gán tay
        </div>
      )}

      <div style={S.cardActions}>
        <label style={S.switchWrap} title={on ? 'Đang mở cho khách chọn' : 'Đang ẩn, chỉ admin thấy'}>
          <input type="checkbox" checked={on} onChange={onToggle} style={S.switchInput} />
          <span style={{ ...S.switch, ...(on ? S.switchOn : {}) }}>
            <span style={{ ...S.knob, ...(on ? S.knobOn : {}) }} />
          </span>
          <span style={{ fontSize: 12.5, color: on ? '#2f7d5d' : '#8a8078' }}>{on ? 'Đang bật' : 'Đang tắt'}</span>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.ghost} onClick={onOpen}>Phân quyền</button>
          <button
            style={{ ...S.ghost, ...(t.invitation_count > 0 ? S.ghostDisabled : S.ghostDanger) }}
            onClick={onDelete}
            title={t.invitation_count > 0 ? 'Đang có thiệp dùng — hãy tắt thay vì xoá' : 'Xoá hẳn mẫu'}
          >Xoá</button>
        </div>
      </div>
    </div>
  )
}

/* =======================================================================
   Nhập theme: chọn .zip -> XEM TRƯỚC báo cáo -> nhập thật
   ======================================================================= */
function ImportDialog({ onClose, onDone }) {
  const modal = useModal()
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ template_code: '', template_name: '', description: '', visibility: 'public', owner_customer_id: '' })
  // Người duyệt gán tay những ô hệ thống không dám đoán: { selector: ten_truong }
  const [overrides, setOverrides] = useState({})
  // null = dùng bộ mặc định của hệ thống; mảng = admin tự tích chọn.
  const [editable, setEditable] = useState(null)
  const [imageRules, setImageRules] = useState(null)
  const [tab, setTab] = useState('xem')

  // Dọn bản xem trước tạm khi đóng hộp thoại — không đợi hết hạn 2 giờ.
  const closeAll = () => {
    if (preview?.preview_token) api.admin.discardPreview(preview.preview_token).catch(() => {})
    onClose()
  }

  const pick = (f) => {
    setFile(f)
    setPreview(null)
    setErr('')
    if (f && !form.template_code) {
      const base = f.name.replace(/\.zip$/i, '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')
      setForm((s) => ({ ...s, template_code: base, template_name: s.template_name || f.name.replace(/\.zip$/i, '') }))
    }
  }

  const runPreview = async () => {
    if (!file) return
    setBusy('preview'); setErr('')
    try {
      const fd = new FormData()
      fd.append('theme', file)
      if (Object.keys(overrides).length) fd.append('overrides', JSON.stringify(overrides))
      const r = await api.admin.previewTheme(fd)
      setPreview(r.data?.data || null)
      setTab('xem')
    } catch (e) { setErr(errText(e)) } finally { setBusy('') }
  }

  const runImport = async () => {
    if (!file || !form.template_code) return
    if (form.visibility === 'exclusive' && !form.owner_customer_id) {
      setErr('Mẫu độc quyền phải nhập ID khách hàng')
      return
    }
    setBusy('import'); setErr('')
    try {
      const fd = new FormData()
      // Đã xem trước rồi thì gửi mã bản tạm, không tải lại hàng chục MB.
      if (preview?.preview_token) fd.append('preview_token', preview.preview_token)
      else fd.append('theme', file)
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      if (Object.keys(overrides).length) fd.append('overrides', JSON.stringify(overrides))
      if (editable !== null) fd.append('editable_fields', JSON.stringify(editable))
      if (imageRules) fd.append('image_slot_rules', JSON.stringify(imageRules))
      const r = await api.admin.importTheme(fd)
      await modal.alert({
        title: 'Đã nhập theme',
        message: `Mẫu "${r.data?.data?.template?.template_name}" đã được tạo ở trạng thái TẮT. `
          + 'Xem trước rồi bật lên để khách chọn được.',
      })
      onDone()
    } catch (e) { setErr(errText(e)) } finally { setBusy('') }
  }

  return (
    <Sheet title="Nhập theme thành mẫu thiệp" onClose={closeAll} wide>
      <div style={S.note}>
        Chọn file <code>.zip</code> nén từ thư mục theme (gồm <code>index.html</code> và thư mục <code>assets</code>).
        Hệ thống tự dò và gắn các ô dữ liệu — tên cô dâu chú rể, ngày cưới, địa chỉ, album ảnh...
        Chỗ nào không đủ chắc chắn thì <strong>không đoán bừa</strong> mà liệt kê ra để bạn gán tay.
      </div>

      <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }}
        onChange={(e) => pick(e.target.files?.[0] || null)} />

      <div style={S.row}>
        <button style={S.ghost} onClick={() => fileRef.current?.click()}>
          {file ? 'Đổi file khác' : 'Chọn file .zip'}
        </button>
        {file && <span style={S.muted}>{file.name} · {Math.round(file.size / 1024)}KB</span>}
        {file && <button style={S.primary} disabled={busy === 'preview'} onClick={runPreview}>
          {busy === 'preview' ? 'Đang phân tích...' : 'Phân tích thử'}
        </button>}
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      {preview && (
        <>
          <div style={S.tabs}>
            {[['xem', 'Xem trước thiệp'], ['gan', 'Kết quả dò trường'], ['quyen', 'Cho khách sửa gì']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ ...S.tab, ...(tab === k ? S.tabOn : null) }}>
                {label}
                {k === 'gan' && preview.report.summary.needsReview > 0 && (
                  <span style={S.tabDot}>{preview.report.summary.needsReview}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'xem' && <PreviewFrame preview={preview} />}
          {tab === 'gan' && (
            <PreviewReport preview={preview} overrides={overrides} setOverrides={setOverrides} onRerun={runPreview} />
          )}
          {tab === 'quyen' && (
            <TemplateFieldPicker
              manifest={preview.manifest}
              catalog={preview.catalog}
              value={editable}
              onChange={setEditable}
              imageRules={imageRules}
              onImageRulesChange={setImageRules}
            />
          )}

          <div style={S.sectionTitle}>Thông tin mẫu</div>
          <div style={S.formGrid}>
            <Field label="Mã mẫu (không dấu)" value={form.template_code}
              onChange={(v) => setForm({ ...form, template_code: v })} />
            <Field label="Tên hiển thị" value={form.template_name}
              onChange={(v) => setForm({ ...form, template_name: v })} />
          </div>
          <Field label="Mô tả ngắn" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />

          <div style={S.sectionTitle}>Ai được dùng mẫu này?</div>
          <VisibilityPicker form={form} setForm={setForm} />

          <div style={{ ...S.row, marginTop: 18, justifyContent: 'flex-end' }}>
            <button style={S.ghost} onClick={closeAll}>Huỷ</button>
            <button style={S.primary} disabled={busy === 'import' || !form.template_code} onClick={runImport}>
              {busy === 'import' ? 'Đang nhập...' : 'Nhập mẫu vào hệ thống'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

/* ---------------- Khung xem trước thiệp thật ----------------
   Bản tạm do BE dựng ra (uploads/templates/_preview/<token>) nên xem được
   NGUYÊN BẢN theme sau khi gắn thẻ — không phải ảnh chụp, không phải mô tả.
   ------------------------------------------------------------ */
const DEVICES = [
  { key: 'phone', label: 'Điện thoại', width: 390 },
  { key: 'tablet', label: 'Máy tính bảng', width: 820 },
  { key: 'desktop', label: 'Máy tính', width: 1280 },
]

function PreviewFrame({ preview }) {
  const [device, setDevice] = useState('phone')
  const url = resolveTemplateUrl(preview.preview_path)
  const dev = DEVICES.find((d) => d.key === device) || DEVICES[0]
  const expires = preview.expires_at ? new Date(preview.expires_at) : null

  return (
    <div style={S.previewBox}>
      <div style={S.row}>
        {DEVICES.map((d) => (
          <button key={d.key} onClick={() => setDevice(d.key)}
            style={{ ...S.chip, ...(device === d.key ? S.chipOn : null) }}>{d.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <a href={url} target="_blank" rel="noreferrer" style={S.link}>Mở tab mới ↗</a>
      </div>
      <div style={S.frameWrap}>
        {/* Thu nhỏ theo tỉ lệ để bản rộng vẫn lọt hộp thoại mà bố cục không đổi. */}
        <iframe
          title="Xem trước theme"
          src={url}
          style={{ ...S.frame, width: dev.width, height: Math.round(760 * (dev.width > 900 ? 1.05 : 1)) }}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
      <div style={S.muted}>
        Đây là bản tạm để duyệt, tự xoá sau 2 giờ
        {expires ? ` (hết hạn ${expires.toLocaleTimeString('vi-VN')})` : ''}. Nhập xong bản tạm bị dọn ngay.
      </div>
    </div>
  )
}

/* ---------------- Báo cáo phân tích ---------------- */
function PreviewReport({ preview, overrides, setOverrides, onRerun }) {
  const { report, manifest, catalog } = preview
  const s = report.summary
  const [showAll, setShowAll] = useState(false)
  const unmapped = showAll ? report.unmapped : report.unmapped.slice(0, 8)

  const setMap = (selector, field) => {
    const next = { ...overrides }
    if (field) next[selector] = field
    else delete next[selector]
    setOverrides(next)
  }

  return (
    <div style={S.report}>
      <div style={S.reportHead}>
        <span style={S.badgeOk}>{s.fields} trường</span>
        <span style={S.badgeOk}>{s.images} ô ảnh</span>
        <span style={S.badgeOk}>{s.hrefs} link</span>
        {s.needsReview > 0 && <span style={S.badgeWarn}>{s.needsReview} chỗ không chắc</span>}
        {report.skipped.length > 0 && (
          <span style={S.badgeMuted}>{report.skipped.length} ảnh trang trí đã bỏ qua</span>
        )}
      </div>

      <div style={S.slotRow}>
        {manifest.image_slots.map((i) => (
          <span key={i.slot} style={S.slotPill}>{i.label}: {i.count} ô</span>
        ))}
      </div>

      {report.unmapped.length > 0 && (
        <>
          <div style={S.sectionTitle}>
            Chưa nhận ra ({report.unmapped.length}) — gán tay nếu cần
          </div>
          <div style={S.muted}>
            Hệ thống cố tình không đoán những chỗ này. Ví dụ hai tên đứng cạnh nhau thì
            không có cách nào biết ai là cô dâu, ai là chú rể — gán nhầm sẽ hiện sai trên thiệp thật.
          </div>
          <div style={S.mapList}>
            {unmapped.map((u) => (
              <div key={u.selector} style={S.mapRow}>
                <code style={S.mapSel} title={u.selector}>{u.selector}</code>
                <span style={S.mapSample} title={u.sample}>{u.sample}</span>
                <select
                  style={S.select}
                  value={overrides[u.selector] || ''}
                  onChange={(e) => setMap(u.selector, e.target.value)}
                >
                  <option value="">— bỏ qua —</option>
                  {catalog.fields.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={S.row}>
            {report.unmapped.length > 8 && (
              <button style={S.ghost} onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Thu gọn' : `Xem tất cả ${report.unmapped.length} mục`}
              </button>
            )}
            {Object.keys(overrides).length > 0 && (
              <button style={S.primary} onClick={onRerun}>
                Phân tích lại với {Object.keys(overrides).length} ô đã gán
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Chọn mức hiển thị ---------------- */
function VisibilityPicker({ form, setForm }) {
  return (
    <div>
      <div style={S.visRow}>
        {Object.entries(VISIBILITY).map(([key, v]) => (
          <button
            key={key}
            style={{ ...S.visOpt, ...(form.visibility === key ? { borderColor: v.color, background: v.bg } : {}) }}
            onClick={() => setForm({ ...form, visibility: key })}
          >
            <strong style={{ color: v.color }}>{v.label}</strong>
            <span style={S.visHint}>{v.hint}</span>
          </button>
        ))}
      </div>
      {form.visibility === 'exclusive' && (
        <Field
          label="ID khách hàng được độc quyền"
          value={form.owner_customer_id}
          onChange={(v) => setForm({ ...form, owner_customer_id: v })}
          placeholder="Dán ID khách hàng (lấy ở tab Khách của CTV)"
        />
      )}
      {form.visibility === 'restricted' && (
        <div style={S.muted}>Nhập xong, mở mục "Phân quyền & chi tiết" để chọn CTV hoặc khách được dùng.</div>
      )}
    </div>
  )
}

/* =======================================================================
   Chi tiết mẫu + phân quyền
   ======================================================================= */
function DetailDialog({ id, onClose, onChanged }) {
  const modal = useModal()
  const [t, setT] = useState(null)
  const [err, setErr] = useState('')
  const [grant, setGrant] = useState({ grantee_type: 'ctv', grantee_id: '', note: '' })
  // Bản nháp quyền sửa: chỉ ghi xuống khi bấm Lưu, để admin tích thoải mái rồi
  // xem lại trước khi áp lên các thiệp đang dùng mẫu.
  const [draft, setDraft] = useState(null)
  const [savingPerm, setSavingPerm] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.admin.getManagedTemplate(id)
      const data = r.data?.data || null
      setT(data)
      setDraft(data ? { editable: data.editable_fields ?? null, images: data.image_slot_rules ?? null } : null)
      setErr('')
    } catch (e) { setErr(errText(e)) }
  }, [id])

  useEffect(() => { load() }, [load])

  const changeVisibility = async (visibility) => {
    let owner = t.owner_customer_id
    if (visibility === 'exclusive') {
      owner = window.prompt('Dán ID khách hàng được độc quyền dùng mẫu này:', owner || '')
      if (!owner) return
    }
    try {
      await api.admin.updateManagedTemplate(id, { visibility, owner_customer_id: owner || undefined })
      await load(); onChanged()
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: errText(e) }) }
  }

  const addGrant = async () => {
    if (!grant.grantee_id.trim()) return
    try {
      await api.admin.grantTemplate(id, grant)
      setGrant({ ...grant, grantee_id: '', note: '' })
      await load(); onChanged()
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: errText(e) }) }
  }

  const toggleGrant = async (p) => {
    try { await api.admin.toggleTemplateGrant(p.id, !p.enabled); await load(); onChanged() }
    catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: errText(e) }) }
  }

  const revoke = async (p) => {
    const ok = await modal.confirm({
      tone: 'danger', title: 'Thu hồi quyền',
      message: `Thu hồi quyền dùng mẫu của "${p.grantee_name || p.grantee_id}"?`,
      confirmText: 'Thu hồi',
    })
    if (!ok) return
    try { await api.admin.revokeTemplateGrant(p.id); await load(); onChanged() }
    catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: errText(e) }) }
  }

  const savePermissions = async () => {
    setSavingPerm(true)
    try {
      await api.admin.updateManagedTemplate(id, {
        editable_fields: draft.editable,
        image_slot_rules: draft.images,
      })
      await load(); onChanged()
      await modal.alert({ title: 'Đã lưu', message: 'Quyền sửa mới áp dụng cho cả thiệp đang dùng mẫu này.' })
    } catch (e) { await modal.alert({ tone: 'danger', title: 'Lỗi', message: errText(e) }) }
    finally { setSavingPerm(false) }
  }

  if (!t) {
    return <Sheet title="Chi tiết mẫu" onClose={onClose}>{err ? <div style={S.err}>⚠️ {err}</div> : <div style={S.muted}>Đang tải...</div>}</Sheet>
  }

  const vis = VISIBILITY[t.visibility] || VISIBILITY.public

  return (
    <Sheet title={t.template_name} onClose={onClose} wide>
      <div style={S.row}>
        <code style={S.code}>{t.template_code}</code>
        <span style={{ ...S.pill, color: vis.color, background: vis.bg }}>{vis.label}</span>
        <span style={S.muted}>{t.invitation_count} thiệp đang dùng</span>
      </div>

      {err && <div style={S.err}>⚠️ {err}</div>}

      <div style={S.sectionTitle}>Ai được dùng mẫu này?</div>
      <div style={S.visRow}>
        {Object.entries(VISIBILITY).map(([key, v]) => (
          <button key={key}
            style={{ ...S.visOpt, ...(t.visibility === key ? { borderColor: v.color, background: v.bg } : {}) }}
            onClick={() => changeVisibility(key)}>
            <strong style={{ color: v.color }}>{v.label}</strong>
            <span style={S.visHint}>{v.hint}</span>
          </button>
        ))}
      </div>
      {t.visibility === 'exclusive' && (
        <div style={S.exclusiveNote}>
          Riêng của: <strong>{t.owner_customer_name || t.owner_customer_id}</strong>
        </div>
      )}
      {t.visibility === 'public' && (
        <div style={S.muted}>Mẫu công khai: danh sách cấp quyền bên dưới không có tác dụng.</div>
      )}

      {t.manifest && draft && (
        <>
          <div style={S.sectionTitle}>Cho khách sửa gì trên mẫu này?</div>
          <TemplateFieldPicker
            manifest={t.manifest}
            catalog={t.catalog}
            value={draft.editable}
            onChange={(v) => setDraft({ ...draft, editable: v })}
            imageRules={draft.images}
            onImageRulesChange={(v) => setDraft({ ...draft, images: v })}
          />
          <div style={{ ...S.row, justifyContent: 'flex-end', marginTop: 10 }}>
            <button style={S.primary} disabled={savingPerm} onClick={savePermissions}>
              {savingPerm ? 'Đang lưu...' : 'Lưu quyền sửa'}
            </button>
          </div>
        </>
      )}

      <div style={S.sectionTitle}>Cấp quyền riêng ({t.permissions.length})</div>
      <div style={S.row}>
        <select style={S.select} value={grant.grantee_type}
          onChange={(e) => setGrant({ ...grant, grantee_type: e.target.value })}>
          {Object.entries(GRANTEE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input style={{ ...S.search, flex: 1 }} placeholder="Dán ID (CTV / khách hàng / tài khoản)"
          value={grant.grantee_id} onChange={(e) => setGrant({ ...grant, grantee_id: e.target.value })} />
        <button style={S.primary} onClick={addGrant}>Cấp quyền</button>
      </div>
      <div style={S.muted}>
        Cấp cho một CTV thì <strong>mọi khách của CTV đó</strong> cũng dùng được mẫu này.
      </div>

      <div style={S.grantList}>
        {t.permissions.length === 0 && <div style={S.muted}>Chưa cấp cho ai.</div>}
        {t.permissions.map((p) => (
          <div key={p.id} style={{ ...S.grantRow, opacity: p.enabled ? 1 : 0.55 }}>
            <span style={S.grantType}>{GRANTEE[p.grantee_type] || p.grantee_type}</span>
            <span style={S.grantName}>{p.grantee_name || p.grantee_id}</span>
            <button style={S.mini} onClick={() => toggleGrant(p)}>{p.enabled ? 'Tắt' : 'Bật'}</button>
            <button style={{ ...S.mini, ...S.miniDanger }} onClick={() => revoke(p)}>Thu hồi</button>
          </div>
        ))}
      </div>

      {t.manifest && (
        <>
          <div style={S.sectionTitle}>Mẫu này hỗ trợ</div>
          <div style={S.slotRow}>
            {(t.manifest.image_slots || []).map((i) => (
              <span key={i.slot} style={S.slotPill}>{i.label}: {i.count} ô</span>
            ))}
          </div>
          <div style={S.muted}>{(t.manifest.fields || []).length} ô dữ liệu chữ</div>
        </>
      )}
    </Sheet>
  )
}

/* ---------------- Thành phần dùng chung ---------------- */
function Sheet({ title, children, onClose, wide }) {
  // Đóng bằng phím Esc — thao tác quen tay khi đang soạn nhanh.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={S.mask} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...S.sheet, ...(wide ? { maxWidth: 860 } : {}) }}>
        <div style={S.sheetHead}>
          <strong style={{ fontSize: 16 }}>{title}</strong>
          <button style={S.close} onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div style={S.sheetBody}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      <input style={S.search} value={value || ''} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/* ---------------- Style ---------------- */
const S = {
  // --- Tab trong hộp thoại nhập theme ---
  tabs: { display: 'flex', gap: 6, marginTop: 16, borderBottom: '1px solid #ede5db' },
  tab: {
    padding: '9px 14px', border: 'none', borderBottom: '2px solid transparent', background: 'none',
    cursor: 'pointer', fontSize: 13.5, color: '#6e625c', fontFamily: 'inherit', display: 'flex',
    alignItems: 'center', gap: 6,
  },
  tabOn: { color: '#c96547', borderBottomColor: '#c96547', fontWeight: 600 },
  tabDot: {
    background: '#fbf3dd', color: '#8a6d1f', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 600,
  },

  // --- Khung xem trước thiệp ---
  previewBox: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
  frameWrap: {
    background: '#f6f1eb', border: '1px solid #ede5db', borderRadius: 12, padding: 12,
    display: 'flex', justifyContent: 'center', overflow: 'auto', maxHeight: 620,
  },
  frame: { border: '1px solid #e3d9cd', borderRadius: 8, background: '#fff', flex: '0 0 auto' },
  chip: {
    padding: '6px 13px', border: '1px solid #ede5db', borderRadius: 20, cursor: 'pointer',
    fontSize: 12.5, background: '#fff', color: '#6e625c', fontFamily: 'inherit',
  },
  chipOn: { background: '#fdf1ec', borderColor: '#e8bdaa', color: '#c96547', fontWeight: 600 },
  link: { fontSize: 12.5, color: '#c96547', textDecoration: 'none' },
  toolbar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  search: {
    padding: '9px 12px', border: '1px solid #ede5db', borderRadius: 9, fontSize: 13.5,
    fontFamily: 'inherit', background: '#fff', minWidth: 220, color: '#1f1917',
  },
  select: {
    padding: '8px 10px', border: '1px solid #ede5db', borderRadius: 9, fontSize: 13,
    fontFamily: 'inherit', background: '#fff', color: '#1f1917',
  },
  primary: {
    padding: '9px 18px', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13.5,
    fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#e58d6f,#c96547)', fontFamily: 'inherit',
  },
  ghost: {
    padding: '9px 16px', border: '1px solid #ede5db', borderRadius: 9, cursor: 'pointer',
    fontSize: 13.5, background: '#f6f1eb', color: '#1f1917', fontFamily: 'inherit',
  },
  mini: {
    padding: '4px 10px', border: '1px solid #ede5db', borderRadius: 7, cursor: 'pointer',
    fontSize: 12, background: '#fff', color: '#1f1917', fontFamily: 'inherit',
  },
  miniDanger: { color: '#c04938', borderColor: '#f0d5d0', background: '#fdf3f1' },
  ghostDanger: { color: '#c04938', borderColor: '#f0d5d0', background: '#fdf3f1' },
  // Mẫu đang có thiệp dùng: nút vẫn bấm được để hiện lời giải thích, nhưng làm mờ
  // để thấy ngay là không nên.
  ghostDisabled: { color: '#b3aaa2', background: '#f6f1eb', cursor: 'not-allowed' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 },
  card: {
    background: '#fff', border: '1px solid #ede5db', borderRadius: 14, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 9,
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  cardName: { fontWeight: 600, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardDesc: { fontSize: 12.5, color: '#6e625c', lineHeight: 1.5 },
  cardMeta: { display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: '#8a8078' },
  cardActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4 },

  pill: { fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' },
  code: { fontSize: 11.5, background: '#f6f1eb', padding: '2px 7px', borderRadius: 6, color: '#6e625c' },
  muted: { fontSize: 12.5, color: '#8a8078', lineHeight: 1.6 },
  err: {
    padding: '10px 14px', background: '#fdf3f1', border: '1px solid #f0d5d0',
    borderRadius: 9, color: '#c04938', fontSize: 13, marginBottom: 12,
  },
  empty: {
    padding: '28px 20px', textAlign: 'center', color: '#6e625c', fontSize: 13.5,
    background: '#f6f1eb', borderRadius: 12, border: '1px dashed #ddd0c2', lineHeight: 1.7,
  },
  note: {
    padding: '12px 14px', background: '#f6f1eb', border: '1px solid #ede5db',
    borderRadius: 10, fontSize: 13, color: '#5c524c', lineHeight: 1.65, marginBottom: 14,
  },
  exclusiveNote: { fontSize: 12.5, color: '#8a3a3a', background: '#fbe9e9', padding: '6px 10px', borderRadius: 7 },
  reviewNote: { fontSize: 12, color: '#8a6d1f', background: '#fbf3dd', padding: '6px 10px', borderRadius: 7 },

  switchWrap: { display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  switchInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },
  switch: {
    width: 38, height: 21, borderRadius: 999, background: '#ddd0c2',
    position: 'relative', transition: 'background .2s', display: 'inline-block',
  },
  switchOn: { background: '#7ec39c' },
  knob: {
    position: 'absolute', top: 2, left: 2, width: 17, height: 17, borderRadius: '50%',
    background: '#fff', transition: 'transform .2s', boxShadow: '0 1px 3px rgba(0,0,0,.18)',
  },
  knobOn: { transform: 'translateX(17px)' },

  mask: {
    position: 'fixed', inset: 0, background: 'rgba(31,25,23,.42)', zIndex: 1000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '40px 16px', overflowY: 'auto',
  },
  sheet: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
    boxShadow: '0 20px 50px -12px rgba(31,25,23,.28)', border: '1px solid #ede5db',
  },
  sheetHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #ede5db',
  },
  sheetBody: { padding: 20, display: 'flex', flexDirection: 'column', gap: 10 },
  close: {
    border: 'none', background: 'transparent', fontSize: 24, lineHeight: 1,
    cursor: 'pointer', color: '#8a8078', padding: '0 4px',
  },

  row: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
    color: '#8a8078', marginTop: 12, marginBottom: 2,
  },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: { fontSize: 12.5, color: '#6e625c', fontWeight: 500 },

  report: {
    background: '#faf7f3', border: '1px solid #ede5db', borderRadius: 12,
    padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
  },
  reportHead: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  badgeOk: { fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: '#e8f5ee', color: '#2f7d5d' },
  badgeWarn: { fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: '#fbf3dd', color: '#8a6d1f' },
  badgeMuted: { fontSize: 12, padding: '4px 10px', borderRadius: 999, background: '#f0eae3', color: '#8a8078' },
  slotRow: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  slotPill: { fontSize: 11.5, padding: '3px 9px', borderRadius: 999, background: '#fff', border: '1px solid #ede5db', color: '#6e625c' },

  mapList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' },
  mapRow: {
    display: 'grid', gridTemplateColumns: 'minmax(90px,1.1fr) minmax(0,1.6fr) minmax(130px,1fr)',
    gap: 8, alignItems: 'center', background: '#fff', border: '1px solid #ede5db',
    borderRadius: 8, padding: '6px 9px',
  },
  mapSel: { fontSize: 11, background: '#f6f1eb', padding: '2px 6px', borderRadius: 5, color: '#6e625c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mapSample: { fontSize: 12.5, color: '#1f1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  visRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 },
  visOpt: {
    display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start',
    padding: '10px 12px', border: '1.5px solid #ede5db', borderRadius: 10,
    background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
  },
  visHint: { fontSize: 11.5, color: '#8a8078', lineHeight: 1.4 },

  grantList: { display: 'flex', flexDirection: 'column', gap: 6 },
  grantRow: {
    display: 'flex', gap: 9, alignItems: 'center', background: '#fff',
    border: '1px solid #ede5db', borderRadius: 9, padding: '7px 11px',
  },
  grantType: { fontSize: 11.5, padding: '2px 8px', borderRadius: 999, background: '#f6f1eb', color: '#6e625c', whiteSpace: 'nowrap' },
  grantName: { flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}

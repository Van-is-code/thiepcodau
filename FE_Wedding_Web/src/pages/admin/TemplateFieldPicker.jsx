import React, { useMemo, useState } from 'react'

// Nhãn nhóm hiển thị trong bảng tích chọn.
const GROUP_LABEL = {
  couple: 'Cô dâu & chú rể',
  family: 'Hai bên gia đình',
  ceremony: 'Lễ thành hôn',
  reception: 'Tiệc cưới',
  content: 'Nội dung, lời ngỏ',
  timeline: 'Chương trình tiệc',
  general: 'Chung',
  bank: 'Ngân hàng mừng cưới',
  khac: 'Khác',
}
const GROUP_ORDER = ['couple', 'family', 'ceremony', 'reception', 'timeline', 'content', 'general', 'bank', 'khac']

/**
 * Bảng cho admin tích chọn khách được sửa những ô nào trên mẫu.
 *
 * Chỉ liệt kê ô mà MẪU NÀY thực sự có (lấy từ manifest) — không đổ cả danh mục 86
 * trường ra, vì phần lớn không tồn tại trong mẫu và tích vào cũng vô nghĩa.
 */
export default function TemplateFieldPicker({ manifest, catalog, value, onChange, imageRules, onImageRulesChange }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(['couple', 'ceremony', 'reception']))

  const never = useMemo(() => new Set(catalog.never_editable || []), [catalog])
  const byKey = useMemo(
    () => Object.fromEntries((catalog.fields || []).map((f) => [f.key, f])),
    [catalog]
  )

  // Nhóm các ô CÓ TRONG MẪU theo chủ đề.
  const groups = useMemo(() => {
    const g = {}
    for (const key of manifest.fields || []) {
      const meta = byKey[key] || { label: key, group: 'khac' }
      const name = meta.group || 'khac'
      if (!g[name]) g[name] = []
      g[name].push({ key, label: meta.label || key, locked: never.has(key) })
    }
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.label.localeCompare(b.label, 'vi'))
    return g
  }, [manifest, byKey, never])

  // value = null nghĩa là "dùng bộ mặc định của hệ thống".
  const isDefault = value === null
  const selected = useMemo(
    () => new Set(isDefault ? (catalog.default_editable || []) : value),
    [isDefault, value, catalog]
  )

  const setKeys = (next) => onChange([...next])

  const toggle = (key) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key); else next.add(key)
    setKeys(next)
  }

  const toggleGroup = (name, on) => {
    const next = new Set(selected)
    for (const f of groups[name]) {
      if (f.locked) continue
      if (on) next.add(f.key); else next.delete(f.key)
    }
    setKeys(next)
  }

  const present = (manifest.fields || []).filter((k) => !never.has(k))
  const countOn = present.filter((k) => selected.has(k)).length

  return (
    <div>
      <div style={S.head}>
        <div>
          <strong style={{ fontSize: 13.5 }}>Khách được sửa {countOn}/{present.length} ô</strong>
          <div style={S.hint}>
            {isDefault
              ? 'Đang dùng bộ mặc định của hệ thống (tên, ngày giờ, địa chỉ, lời cảm ơn).'
              : 'Bạn đã tự chọn. Ô không tích vẫn hiện dữ liệu thật, chỉ không cho khách sửa tại chỗ.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={S.mini} onClick={() => setOpenGroups(new Set(GROUP_ORDER))}>Mở hết nhóm</button>
          <button style={S.mini} onClick={() => setOpenGroups(new Set())}>Thu hết</button>
          <button style={S.mini} onClick={() => onChange(null)} disabled={isDefault}>Về mặc định</button>
          <button style={S.mini} onClick={() => setKeys(new Set(present))}>Chọn hết</button>
          <button style={S.mini} onClick={() => setKeys(new Set())}>Bỏ hết</button>
        </div>
      </div>

      {GROUP_ORDER.filter((g) => groups[g]?.length).map((name) => {
        const list = groups[name]
        const open = openGroups.has(name)
        const on = list.filter((f) => !f.locked && selected.has(f.key)).length
        const total = list.filter((f) => !f.locked).length
        return (
          <div key={name} style={S.group}>
            <div style={S.groupHead}>
              <button
                style={S.groupToggle}
                aria-expanded={open}
                onClick={() => setOpenGroups((truoc) => {
                  // Phải dựng từ giá trị MỚI NHẤT: bấm nhanh hai nhóm liên tiếp mà
                  // dựng từ biến của lần render cũ thì nhóm trước bị mất.
                  const n = new Set(truoc)
                  if (n.has(name)) n.delete(name); else n.add(name)
                  return n
                })}
              >
                <span style={{ transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform .15s' }}>›</span>
                {GROUP_LABEL[name] || name}
                <span style={S.groupCount}>{on}/{total}</span>
              </button>
              {total > 0 && (
                <div style={{ display: 'flex', gap: 5 }}>
                  <button style={S.tiny} onClick={() => toggleGroup(name, true)}>Chọn nhóm</button>
                  <button style={S.tiny} onClick={() => toggleGroup(name, false)}>Bỏ nhóm</button>
                </div>
              )}
            </div>
            {open && (
              <div style={S.fieldGrid}>
                {list.map((f) => (
                  <label key={f.key} style={{ ...S.field, ...(f.locked ? S.fieldLocked : {}) }}
                    title={f.locked ? 'Thông tin ngân hàng sửa qua panel quét mã QR, không sửa tại chỗ' : f.key}>
                    <input
                      type="checkbox"
                      data-field-key={f.key}
                      checked={!f.locked && selected.has(f.key)}
                      disabled={f.locked}
                      onChange={() => toggle(f.key)}
                    />
                    <span>{f.label}</span>
                    {f.locked && <span style={S.lockTag}>khoá</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {(manifest.image_slots || []).length > 0 && (
        <ImageSlotRules slots={manifest.image_slots} catalog={catalog} value={imageRules} onChange={onImageRulesChange} />
      )}
    </div>
  )
}

/* ---------------- Quy tắc từng ô ảnh ---------------- */
function ImageSlotRules({ slots, catalog, value, onChange }) {
  const meta = Object.fromEntries((catalog.image_slots || []).map((s) => [s.key, s]))
  const rules = value || {}

  const setRule = (slot, patch) => {
    const next = { ...rules, [slot]: { ...(rules[slot] || {}), ...patch } }
    onChange(next)
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={S.sectionTitle}>Ảnh — khách được làm gì</div>
      <div style={S.hint}>
        Album cố định đúng số ô thiết kế sẽ đẹp hơn; cho tải thêm thì khách tự thêm ảnh
        đến mức tối đa bạn đặt.
      </div>
      <div style={S.slotList}>
        {slots.map((s) => {
          const m = meta[s.slot] || {}
          const r = rules[s.slot] || {}
          const nhieu = Boolean(m.multiple)
          return (
            <div key={s.slot} style={S.slotRow}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ fontSize: 13 }}>{s.label}</strong>
                <div style={S.hint}>{s.count} ô trong mẫu</div>
              </div>
              <label style={S.check}>
                <input type="checkbox" checked={r.allow_change !== false}
                  onChange={(e) => setRule(s.slot, { allow_change: e.target.checked })} />
                <span>Cho đổi ảnh</span>
              </label>
              {nhieu && (
                <>
                  <label style={S.check}>
                    <input type="checkbox" checked={r.allow_add !== false}
                      onChange={(e) => setRule(s.slot, { allow_add: e.target.checked })} />
                    <span>Cho tải thêm</span>
                  </label>
                  <label style={S.check}>
                    <span>Tối đa</span>
                    <input type="number" min="1" max={m.max || 20} style={S.num}
                      value={r.max ?? s.count}
                      onChange={(e) => setRule(s.slot, { max: Number(e.target.value) })} />
                    <span style={S.hint}>ảnh</span>
                  </label>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const S = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  hint: { fontSize: 11.5, color: '#8a8078', lineHeight: 1.5 },
  mini: { padding: '4px 10px', border: '1px solid #ede5db', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, background: '#fff', fontFamily: 'inherit', color: '#1f1917' },
  tiny: { padding: '2px 8px', border: '1px solid #ede5db', borderRadius: 6, cursor: 'pointer', fontSize: 11, background: '#fff', fontFamily: 'inherit', color: '#6e625c' },
  group: { border: '1px solid #ede5db', borderRadius: 10, marginBottom: 7, background: '#fff', overflow: 'hidden' },
  groupHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#faf7f3', gap: 8 },
  groupToggle: { display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#1f1917', fontFamily: 'inherit', padding: 0 },
  groupCount: { fontSize: 11, color: '#8a8078', fontWeight: 400 },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 4, padding: '8px 10px' },
  field: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', padding: '2px 0' },
  fieldLocked: { opacity: 0.5, cursor: 'not-allowed' },
  lockTag: { fontSize: 10, background: '#f0eae3', color: '#8a8078', padding: '1px 5px', borderRadius: 4 },
  sectionTitle: { fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a8078', marginBottom: 3 },
  slotList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 },
  slotRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: '1px solid #ede5db', borderRadius: 9, padding: '8px 11px', background: '#fff' },
  check: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' },
  num: { width: 56, padding: '3px 6px', border: '1px solid #ede5db', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit' },
}

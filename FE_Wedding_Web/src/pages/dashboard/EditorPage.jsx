import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { dayThangLenR2 } from '../../lib/uploadR2'
import { useModal } from '../../components/Modal'
import {
  buildIframeDocument,
  buildMergedData,
  resolveTemplateUrl,
  resolveWriteTarget,
} from '../../lib/templateEngine'
import {
  IconChevronLeft,
  IconHeart,
  IconPalette,
  IconCheck,
  IconLock,
  IconExternalLink,
  IconSparkles,
  IconAlertCircle,
  IconQrCode,
  IconMusic,
} from '../../components/Icons'
import BankQrPanel from '../../components/BankQrPanel'
import MusicPanel from '../../components/MusicPanel'
import ImageCropper from '../../components/ImageCropper'

// data:image/png;base64,... -> File (để upload QR sinh ra làm ảnh thiệp)
function dataUriToFile(uri, name) {
  try {
    const [head, b64] = uri.split(',')
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/png'
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return new File([arr], name, { type: mime })
  } catch (_e) {
    return null
  }
}

export default function EditorPage() {
  const { invitationId } = useParams()
  const navigate = useNavigate()
  const modal = useModal()
  const iframeRef = useRef(null)
  const templateHtmlRef = useRef('') // HTML gốc của mẫu, để dựng lại iframe khi cần
  const scrollRestoreRef = useRef(0)

  const [invitation, setInvitation] = useState(null)
  const [iframeDoc, setIframeDoc] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [pending, setPending] = useState({ inv: {}, groom: {}, bride: {}, extra: {} })
  const [lockState, setLockState] = useState(null)
  const [bankPanel, setBankPanel] = useState(false)
  const [musicPanel, setMusicPanel] = useState(false)
  const [cropTask, setCropTask] = useState(null) // { file, ratio, field, index }
  // Hàng đợi cắt ảnh khi tải NHIỀU ảnh album 1 lần: cắt xong ảnh này -> lưu -> ảnh kế.
  const [cropQueue, setCropQueue] = useState(null) // { files: File[], ratio, field, baseIndex, pos, total }
  const galleryUploadRef = useRef(null)

  const GALLERY_RATIO = 0.72 // ~3:4, khớp khung carousel album của mẫu

  const nextGalleryIndex = useCallback(
    () =>
      (invitation?.images || [])
        .filter((img) => img.image_type === 'gallery')
        .reduce((max, img) => Math.max(max, (img.sort_order ?? 0) + 1), 0),
    [invitation],
  )

  const startCropQueue = useCallback(
    (files, ratio, field = 'gallery') => {
      const list = Array.from(files || []).filter((f) => f && f.type?.startsWith('image/'))
      if (!list.length) return
      const baseIndex = field === 'gallery' ? nextGalleryIndex() : 0
      setCropQueue({ files: list, ratio: ratio || GALLERY_RATIO, field, baseIndex, pos: 0, total: list.length })
      setCropTask({ file: list[0], ratio: ratio || GALLERY_RATIO, field, index: baseIndex, queued: true })
    },
    [nextGalleryIndex],
  )

  const dirty = useMemo(
    () =>
      Object.keys(pending.inv).length +
        Object.keys(pending.groom).length +
        Object.keys(pending.bride).length +
        Object.keys(pending.extra).length >
      0,
    [pending],
  )

  const locked = Boolean(lockState?.locked)
  const editsLeft = lockState?.editsLeft ?? null

  const mergedForIframe = useCallback(
    (inv, pend) => ({
      ...inv,
      ...pend.inv,
      extra_data: { ...(inv?.extra_data || {}), ...pend.extra },
      groom: { ...(inv?.groom || {}), ...pend.groom },
      bride: { ...(inv?.bride || {}), ...pend.bride },
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await api.getInvitationById(invitationId)
        const invData = res.data?.data || res.data
        if (!invData) throw new Error('Không tìm thấy thiệp')

        const isLocked = Boolean(invData.lock_state?.locked)
        const editEntryPath = invData.template?.schema?.editHtmlPath
        const templateUrl = resolveTemplateUrl(editEntryPath || invData.template?.html_path)
        if (!templateUrl) throw new Error('Thiệp này chưa được gán mẫu giao diện')

        const htmlRes = await fetch(templateUrl, { cache: 'default' })
        if (!htmlRes.ok) throw new Error(`Không tải được mẫu: ${templateUrl}`)
        const html = await htmlRes.text()

        if (cancelled) return
        templateHtmlRef.current = html
        setInvitation(invData)
        setLockState(invData.lock_state || null)
        // Quyền sửa do admin cấu hình trên MẪU: ô nào không được chọn thì vẫn
        // hiện dữ liệu nhưng không bấm sửa tại chỗ được.
        setIframeDoc(buildIframeDocument(html, invData, {
          editMode: !isLocked,
          editableFields: invData?.template?.editable_fields ?? null,
          imageSlotRules: invData?.template?.image_slot_rules ?? null,
        }))
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || err.message || 'Có lỗi xảy ra')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [invitationId])

  const pushToIframe = useCallback(
    (inv, pend) => {
      const merged = buildMergedData(mergedForIframe(inv, pend))
      iframeRef.current?.contentWindow?.postMessage({ type: 'wedding-web:data-updated', data: merged }, '*')
    },
    [mergedForIframe],
  )

  // Album ảnh: chèn/xoá ô carousel LÚC ĐANG CHẠY khiến engine gallery của LadiPage
  // desync -> gallery trắng. Cách chắc ăn là dựng lại iframe để LadiPage init lại
  // sạch với đúng số ảnh; giữ nguyên vị trí cuộn cho đỡ giật.
  const rebuildIframe = useCallback(
    (inv, pend) => {
      if (!templateHtmlRef.current) return
      scrollRestoreRef.current = iframeRef.current?.contentWindow?.scrollY || 0
      setIframeDoc(
        buildIframeDocument(templateHtmlRef.current, mergedForIframe(inv, pend), {
          editMode: !locked,
          editableFields: inv?.template?.editable_fields ?? null,
          imageSlotRules: inv?.template?.image_slot_rules ?? null,
        }),
      )
    },
    [mergedForIframe, locked],
  )

  const handleIframeLoad = useCallback(() => {
    const y = scrollRestoreRef.current
    if (!y) return
    let tries = 0
    const tick = () => {
      const win = iframeRef.current?.contentWindow
      if (win) win.scrollTo(0, y)
      if (++tries < 20) setTimeout(tick, 80)
    }
    tick()
  }, [])

  const stageField = useCallback(
    (field, value) => {
      setPending((prev) => {
        const target = resolveWriteTarget(field)
        const next = { inv: { ...prev.inv }, groom: { ...prev.groom }, bride: { ...prev.bride }, extra: { ...prev.extra } }
        if (target.scope === 'groom') next.groom[target.column] = value
        else if (target.scope === 'bride') next.bride[target.column] = value
        else if (target.scope === 'extra_data') next.extra[target.column] = value
        else next.inv[target.column] = value
        pushToIframe(invitation, next)
        return next
      })
    },
    [invitation, pushToIframe],
  )

  const saveImage = useCallback(
    async (field, index, file) => {
      if (locked) {
        await modal.alert({ tone: 'warn', title: 'Thiệp đã khoá', message: lockNote(lockState) })
        return
      }
      setSaveStatus('saving')
      try {
        const existing = (invitation.images || []).find(
          (img) => img.image_type === field && (index === null ? true : (img.sort_order || 0) === index),
        )
        // Ưu tiên đẩy thẳng lên R2: ảnh không đi qua đường mạng của máy chủ nhà.
        // Chưa bật R2 (hoặc đẩy thẳng hỏng) thì trả null -> rơi xuống cách cũ.
        let saved = await dayThangLenR2(file, {
          invitationId: invitation.id,
          imageType: field,
          sortOrder: index ?? 0,
          imageAlt: field,
          replaceId: existing ? existing.id : null,
        })

        if (!saved) {
          const formData = new FormData()
          formData.append('image', file)
          formData.append('invitation_id', invitation.id)
          formData.append('image_type', field)
          formData.append('sort_order', String(index ?? 0))
          formData.append('image_alt', field)

          if (existing) {
            const res = await api.updateInvitationImage(existing.id, formData)
            saved = res.data?.data || res.data
          } else {
            const res = await api.createInvitationImage(formData)
            saved = res.data?.data || res.data
          }
        }
        const nextImages = existing
          ? (invitation.images || []).map((img) => (img.id === existing.id ? saved : img))
          : [...(invitation.images || []), saved]
        const nextInvitation = { ...invitation, images: nextImages }
        setInvitation(nextInvitation)
        pushToIframe(nextInvitation, pending)
        setSaveStatus('saved')
        return nextInvitation
      } catch (err) {
        console.error('Save image failed:', err)
        setSaveStatus('error')
        return null
      }
    },
    [invitation, pending, locked, lockState, modal, pushToIframe],
  )

  const queueLatestInvRef = useRef(null)

  // Cắt xong 1 ảnh trong hàng đợi album -> lưu -> chuyển sang ảnh kế (hoặc kết thúc).
  const advanceQueue = useCallback(
    async (croppedFileOrNull) => {
      const q = cropQueue
      if (!q) { setCropTask(null); return }
      setCropTask(null)
      if (croppedFileOrNull) {
        const inv = await saveImage(q.field, q.baseIndex + q.pos, croppedFileOrNull)
        if (inv) queueLatestInvRef.current = inv
      }
      const nextPos = q.pos + 1
      if (nextPos < q.total) {
        setCropQueue({ ...q, pos: nextPos })
        setCropTask({ file: q.files[nextPos], ratio: q.ratio, field: q.field, index: q.baseIndex + nextPos, queued: true })
      } else {
        setCropQueue(null)
        if (q.field === 'gallery') rebuildIframe(queueLatestInvRef.current || invitation, pending)
        queueLatestInvRef.current = null
        await modal.alert({ tone: 'success', title: 'Đã thêm ảnh', message: `Đã thêm ${q.total} ảnh vào album.` })
      }
    },
    [cropQueue, saveImage, modal, rebuildIframe, invitation, pending],
  )

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data) return
      if (event.data.type === 'wedding-web:open-bank-qr') {
        if (locked) modal.alert({ tone: 'warn', title: 'Thiệp đã khoá', message: lockNote(lockState) })
        else setBankPanel(true)
        return
      }
      if (event.data.type === 'wedding-web:edit') {
        const { field, kind, value, index, file, files } = event.data
        if (kind === 'image' && file) {
          if (locked) { modal.alert({ tone: 'warn', title: 'Thiệp đã khoá', message: lockNote(lockState) }); return }
          // Mở popup CẮT ẢNH trước khi upload (không gửi ảnh gốc).
          setCropTask({ file, ratio: event.data.ratio || null, field, index })
        } else if (kind === 'image-batch' && files?.length) {
          if (locked) { modal.alert({ tone: 'warn', title: 'Thiệp đã khoá', message: lockNote(lockState) }); return }
          startCropQueue(files, event.data.ratio, field)
        } else if (kind === 'field') stageField(field, value)
        return
      }
      if (event.data.type === 'wedding-web:navigate' && event.data.file && invitation) {
        const baseUrl = resolveTemplateUrl(invitation.template?.html_path)
        if (!baseUrl) return
        try {
          const fullBase = /^https?:\/\//i.test(baseUrl)
            ? baseUrl
            : (typeof window !== 'undefined' ? new URL(baseUrl, window.location.origin).href : baseUrl)
          const nextUrl = new URL(event.data.file, fullBase).href
          fetch(nextUrl, { cache: 'default' })
            .then((r) => r.text())
            .then((html) =>
              setIframeDoc(buildIframeDocument(html, mergedForIframe(invitation, pending), {
                editMode: !locked,
                editableFields: invitation?.template?.editable_fields ?? null,
                imageSlotRules: invitation?.template?.image_slot_rules ?? null,
              }))
            )
            .catch((err) => console.error('Editor navigate failed:', err))
        } catch (err) {
          console.error('Editor navigate failed:', err)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [stageField, saveImage, startCropQueue, invitation, pending, locked, lockState, modal, mergedForIframe])

  const applyServerResult = (data) => {
    setInvitation((prev) => ({ ...prev, ...data, groom: data.groom || prev.groom, bride: data.bride || prev.bride }))
    setLockState(data.lock_state || null)
    setPending({ inv: {}, groom: {}, bride: {}, extra: {} })
  }

  const handleSave = async () => {
    if (!dirty || locked) return
    const left = editsLeft ?? '?'
    const ok = await modal.confirm({
      tone: 'default',
      title: 'Xác nhận lưu thiệp cưới',
      message: `Bạn còn ${left} lượt sửa.\nLưu lần này sẽ trừ 1 lượt (còn ${Math.max((editsLeft ?? 1) - 1, 0)} lượt).\n\nBạn có chắc chắn muốn lưu các thay đổi này?`,
      confirmText: 'Lưu Ngay',
      cancelText: 'Chưa Lưu',
    })
    if (!ok) return

    setSaveStatus('saving')
    try {
      const invPayload = { ...pending.inv }
      if (Object.keys(pending.extra).length) {
        invPayload.extra_data = { ...(invitation.extra_data || {}), ...pending.extra }
      }
      const res = await api.editorSaveInvitation(invitation.id, {
        invitation: invPayload,
        groom: pending.groom,
        bride: pending.bride,
      })
      const data = res.data?.data || res.data
      applyServerResult(data)
      setSaveStatus('saved')
      const st = data.lock_state
      if (st?.locked) {
        await modal.alert({
          tone: 'warn',
          title: 'Đã lưu — Thiệp khoá sửa',
          message: `Đã lưu thành công.\n${lockNote(st)}`,
        })
      } else {
        await modal.alert({
          tone: 'success',
          title: 'Đã lưu thành công',
          message: `Đã lưu thông tin thiệp cưới. Bạn còn ${st?.editsLeft ?? '?'} lượt sửa.`,
        })
      }
    } catch (err) {
      setSaveStatus('error')
      const msg = err?.response?.data?.message || err.message || 'Lưu thất bại'
      const st = err?.response?.data?.lockState
      if (st) setLockState(st)
      await modal.alert({ tone: 'danger', title: 'Không lưu được', message: msg })
    }
  }

  const handleChangeTemplate = async () => {
    if (locked) {
      await modal.alert({ tone: 'warn', title: 'Thiệp đã khoá', message: lockNote(lockState) })
      return
    }
    let templates = []
    try {
      const res = await api.getTemplates()
      templates = (res.data?.data?.items || res.data?.data || res.data || []).filter(Boolean)
    } catch (_e) {}
    if (!templates.length) {
      await modal.alert({ title: 'Đổi mẫu', message: 'Chưa có mẫu nào khác để chọn.' })
      return
    }
    const list = templates.map((t) => `• ${t.template_name || t.template_code || t.id}`).join('\n')
    const ok = await modal.confirm({
      title: 'Đổi mẫu thiệp cưới',
      message: `Đổi mẫu KHÔNG tính vào lượt sửa (được đổi thoải mái cho tới khi thiệp bị khoá).\n\nDanh sách mẫu hiện có:\n${list}\n\nĐổi sang mẫu đầu tiên trong danh sách?`,
      confirmText: 'Đổi Mẫu',
    })
    if (!ok) return
    try {
      await api.changeInvitationTemplate(invitation.id, templates[0].id)
      await modal.alert({ tone: 'success', title: 'Đã đổi mẫu', message: 'Đang tải lại trang sửa...' })
      window.location.reload()
    } catch (err) {
      await modal.alert({
        tone: 'danger',
        title: 'Đổi mẫu thất bại',
        message: err?.response?.data?.message || err.message,
      })
    }
  }

  const openPanel = (setter) => async () => {
    if (locked) { await modal.alert({ tone: 'warn', title: 'Thiệp đã khoá', message: lockNote(lockState) }); return }
    setter(true)
  }
  const openBankPanel = openPanel(setBankPanel)
  // Mẫu thiệp có hộp nhạc không. Cột has_music_box do admin chốt; chưa chốt thì
  // suy từ manifest (theme có thẻ <audio> hay không). Mẫu không có hộp nhạc mà
  // vẫn hiện nút chọn nhạc thì khách chọn xong không nghe thấy gì, tưởng hỏng.
  const coHopNhac = (() => {
    const tpl = invitation?.template
    if (!tpl) return true
    if (tpl.has_music_box != null) return Boolean(tpl.has_music_box)
    return Boolean(tpl.manifest && tpl.manifest.has_music_box)
  })()

  const openMusicPanel = openPanel(setMusicPanel)

  // Sau khi quét + lưu QR (1 QR chung cả thiệp): cập nhật extra_data.bank + lưu ảnh QR
  // vào mục Quà cưới (image_type: bank_qr) + đẩy vào iframe để hiện ngay.
  const handleBankSaved = async (info) => {
    setBankPanel(false)
    setInvitation((prev) => ({ ...prev, extra_data: { ...(prev.extra_data || {}), bank: info.bank } }))
    if (info.qrImage) {
      const file = dataUriToFile(info.qrImage, 'bank-qr.png')
      if (file) await saveImage('bank_qr', null, file)
    }
    await modal.alert({ tone: 'success', title: 'Đã lưu QR', message: 'Mã QR & tài khoản ngân hàng đã lưu vào mục Quà cưới của thiệp.' })
  }

  // Sau khi lưu nhạc: cập nhật music_url + playlist local + đẩy vào iframe.
  const handleMusicSaved = (data) => {
    setMusicPanel(false)
    const nextInv = {
      ...invitation,
      music_url: data?.music_url || invitation.music_url,
      extra_data: { ...(invitation.extra_data || {}), music_playlist: data?.extra_data?.music_playlist || [] },
    }
    setInvitation(nextInv)
    pushToIframe(nextInv, pending)
  }

  if (loading) {
    return (
      <div style={S.center}>
        <div style={S.loadCard}>
          <IconSparkles size={32} color="#d97757" />
          <p style={{ marginTop: 12, fontSize: 14, color: '#5c524c', fontWeight: 500 }}>
            Đang tải trình chỉnh sửa thiệp cưới...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={S.center}>
        <div style={{ ...S.loadCard, borderColor: 'rgba(192,73,56,0.3)' }}>
          <p style={{ color: '#c04938', marginBottom: 14, fontSize: 14, fontWeight: 600 }}>❌ {error}</p>
          <button style={S.btnBackHome} onClick={() => navigate('/dashboard')}>
            Quay lại Danh Sách Thiệp
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <div style={S.left}>
          <button style={S.backBtn} onClick={() => navigate('/dashboard')}>
            <IconChevronLeft size={16} />
            <span>Danh Sách Thiệp</span>
          </button>

          <div style={S.titleWrap}>
            <IconHeart size={16} color="#d97757" />
            <span style={S.title}>{invitation?.title_vi || 'Thiệp cưới của bạn'}</span>
          </div>
        </div>

        <div style={S.centerStatus}>
          {locked ? (
            <span style={S.lockBadge}>
              <IconLock size={14} />
              <span>Đã khoá sửa</span>
            </span>
          ) : (
            <span
              style={{
                ...S.statusPill,
                color: saveStatus === 'error' ? '#c04938' : saveStatus === 'saved' ? '#4f7e65' : '#6e625c',
                background:
                  saveStatus === 'error'
                    ? 'rgba(192,73,56,0.1)'
                    : saveStatus === 'saved'
                    ? 'rgba(79,126,101,0.12)'
                    : '#f6f1eb',
              }}
            >
              {saveStatus === 'saving' && '⏳ Đang lưu…'}
              {saveStatus === 'saved' && '✓ Đã lưu thay đổi'}
              {saveStatus === 'error' && '⚠ Lưu thất bại'}
              {saveStatus === 'idle' && (dirty ? '● Có thay đổi chưa lưu' : '💡 Chạm chữ hoặc ảnh trên thiệp để sửa')}
            </span>
          )}
        </div>

        <div style={S.rightActions}>
          {coHopNhac && (
            <button style={S.tplBtn} onClick={openMusicPanel} disabled={locked}>
              <IconMusic size={15} />
              <span>Nhạc Nền</span>
            </button>
          )}

          <button style={S.tplBtn} onClick={openBankPanel} disabled={locked}>
            <IconQrCode size={15} />
            <span>QR Ngân Hàng</span>
          </button>

          <button
            style={S.tplBtn}
            onClick={() => galleryUploadRef.current?.click()}
            disabled={locked}
            title="Chọn nhiều ảnh cùng lúc để thêm vào album"
          >
            <IconSparkles size={15} />
            <span>Thêm Ảnh Album</span>
          </button>

          <button style={S.tplBtn} onClick={handleChangeTemplate} disabled={locked}>
            <IconPalette size={15} />
            <span>Đổi Mẫu</span>
          </button>

          <button
            style={{ ...S.saveBtn, opacity: !dirty || locked || saveStatus === 'saving' ? 0.5 : 1 }}
            onClick={handleSave}
            disabled={!dirty || locked || saveStatus === 'saving'}
          >
            <IconCheck size={16} />
            <span>{locked ? 'Đã Khoá' : `Lưu Thiệp${editsLeft != null ? ` (còn ${editsLeft})` : ''}`}</span>
          </button>

          {invitation?.invitation_slug && (
            <a style={S.viewLink} href={`/${invitation.invitation_slug}`} target="_blank" rel="noreferrer">
              <IconExternalLink size={15} />
              <span>Xem Thiệp</span>
            </a>
          )}
        </div>
      </header>

      {locked && (
        <div style={S.lockBar}>
          <IconLock size={15} />
          <span>{lockNote(lockState)} — Bạn và khách vẫn có thể xem và chia sẻ thiệp bình thường.</span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        srcDoc={iframeDoc}
        onLoad={handleIframeLoad}
        style={S.iframe}
        sandbox="allow-scripts allow-same-origin allow-popups allow-modals allow-forms allow-downloads"
        title="Trình sửa thiệp cưới"
      />

      {bankPanel && (
        <BankQrPanel invitation={invitation} onSaved={handleBankSaved} onClose={() => setBankPanel(false)} />
      )}
      {musicPanel && coHopNhac && (
        <MusicPanel invitation={invitation} onSaved={handleMusicSaved} onClose={() => setMusicPanel(false)} />
      )}
      {cropTask && (
        <ImageCropper
          key={cropTask.file?.name + '|' + cropTask.index}
          file={cropTask.file}
          ratio={cropTask.ratio}
          queueLabel={cropQueue ? `Ảnh ${cropQueue.pos + 1}/${cropQueue.total}` : null}
          onCancel={() => (cropQueue ? advanceQueue(null) : setCropTask(null))}
          onDone={async (croppedFile) => {
            const t = cropTask
            if (cropQueue) { advanceQueue(croppedFile); return }
            setCropTask(null)
            const inv = await saveImage(t.field, t.index, croppedFile)
            // Album carousel của LadiPage cần init lại sạch sau khi đổi ảnh.
            if (t.field === 'gallery' && inv) rebuildIframe(inv, pending)
          }}
        />
      )}
      {galleryUploadRef && (
        <input
          ref={galleryUploadRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            // Sao chép File ra mảng TRƯỚC khi reset input (reset sẽ xoá luôn e.target.files).
            const files = Array.from(e.target.files || [])
            e.target.value = ''
            if (locked) {
              modal.alert({ tone: 'warn', title: 'Thiệp đã khoá', message: lockNote(lockState) })
              return
            }
            startCropQueue(files, GALLERY_RATIO, 'gallery')
          }}
        />
      )}
    </div>
  )
}

function lockNote(st) {
  if (!st) return 'Thiệp đang bị khoá sửa.'
  if (st.reason === 'past_wedding')
    return `Thiệp đã khoá sửa (quá ${st.lockDaysAfterWedding} ngày sau ngày cưới). Liên hệ admin nếu cần mở lại.`
  if (st.reason === 'out_of_edits')
    return `Đã dùng hết ${st.maxEdits} lượt sửa. Liên hệ admin nếu cần cấp thêm lượt.`
  return 'Thiệp đang bị khoá sửa.'
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    backgroundColor: '#1f1917',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: '10px 18px',
    background: 'rgba(31, 25, 23, 0.96)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    flexShrink: 0,
    flexWrap: 'wrap',
    zIndex: 20,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 220,
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    color: '#fff',
    borderRadius: 9999,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  titleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  centerStatus: {
    display: 'flex',
    alignItems: 'center',
  },
  statusPill: {
    fontSize: 12.5,
    fontWeight: 600,
    padding: '6px 14px',
    borderRadius: 9999,
    whiteSpace: 'nowrap',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  lockBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    fontWeight: 600,
    background: 'rgba(201, 169, 110, 0.25)',
    color: '#e5c378',
    padding: '6px 14px',
    borderRadius: 9999,
    whiteSpace: 'nowrap',
  },
  rightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  tplBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#fff',
    borderRadius: 9999,
    padding: '7px 15px',
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    border: 'none',
    color: '#fff',
    borderRadius: 9999,
    padding: '8px 18px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 14px rgba(217, 119, 87, 0.35)',
    transition: 'all 0.2s ease',
  },
  viewLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 500,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    background: 'rgba(255, 255, 255, 0.08)',
    padding: '7px 14px',
    borderRadius: 9999,
    border: '1px solid rgba(255, 255, 255, 0.18)',
  },
  lockBar: {
    background: 'rgba(201, 169, 110, 0.15)',
    color: '#f4ecdc',
    fontSize: 12.5,
    padding: '8px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderBottom: '1px solid rgba(201, 169, 110, 0.25)',
  },
  iframe: {
    flex: 1,
    width: '100%',
    border: 'none',
    background: '#fff',
  },
  center: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fcfaf7',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    padding: 20,
  },
  loadCard: {
    background: '#fff',
    border: '1px solid #ede5db',
    borderRadius: 20,
    padding: '36px 32px',
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(31, 25, 23, 0.08)',
    maxWidth: 420,
  },
  btnBackHome: {
    padding: '10px 22px',
    background: '#d97757',
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  bankOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(31,25,23,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 50,
  },
  bankSheet: {
    width: 'min(560px, 100%)',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: '#fcfaf7',
    borderRadius: 20,
    boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
  },
  bankHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '20px 22px 14px',
    borderBottom: '1px solid #ede5db',
  },
  bankTitle: { fontSize: 16, fontWeight: 700, color: '#1f1917', display: 'flex', alignItems: 'center', gap: 8 },
  bankSub: { fontSize: 12.5, color: '#6e625c', marginTop: 6, lineHeight: 1.5 },
  bankClose: {
    background: '#f6f1eb',
    border: '1px solid #ede5db',
    borderRadius: 10,
    padding: 8,
    cursor: 'pointer',
    color: '#6e625c',
    display: 'flex',
    flexShrink: 0,
  },
  bankBody: { padding: '8px 18px 20px' },
}

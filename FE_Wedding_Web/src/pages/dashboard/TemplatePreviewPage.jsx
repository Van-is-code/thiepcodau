import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { buildIframeDocument, resolveTemplateUrl } from '../../lib/templateEngine'
import ChangeSlugModal from '../../components/ChangeSlugModal'
import {
  IconChevronLeft,
  IconEye,
  IconSparkles,
} from '../../components/Icons'

export default function TemplatePreviewPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()

  const [template, setTemplate] = useState(null)
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [showSlugModal, setShowSlugModal] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        setLoading(true)
        setError('')

        const res = await api.getTemplateById(templateId)
        const tpl = res.data?.data || res.data
        if (!tpl) throw new Error('Không tìm thấy mẫu')

        const templateUrl = resolveTemplateUrl(tpl.html_path)
        if (!templateUrl) throw new Error('Mẫu này chưa có file giao diện')

        const htmlRes = await fetch(templateUrl)
        if (!htmlRes.ok) throw new Error(`Không tải được mẫu: ${templateUrl}`)
        const htmlText = await htmlRes.text()

        if (cancelled) return
        setTemplate(tpl)
        setHtml(htmlText)
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
  }, [templateId])

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data || event.data.type !== 'wedding-web:navigate' || !event.data.file || !template) return
      const baseUrl = resolveTemplateUrl(template.html_path)
      if (!baseUrl) return
      try {
        const fullBase = /^https?:\/\//i.test(baseUrl)
          ? baseUrl
          : (typeof window !== 'undefined' ? new URL(baseUrl, window.location.origin).href : baseUrl)
        const nextUrl = new URL(event.data.file, fullBase).href
        fetch(nextUrl).then((r) => r.text()).then(setHtml).catch((err) => console.error('Preview navigate failed:', err))
      } catch (err) {
        console.error('Preview navigate failed:', err)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [template])

  const handleBack = () => {
    const token = localStorage.getItem('token')
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate(token ? '/dashboard/templates' : '/templates')
    }
  }

  const handleUseTemplate = () => {
    const token = localStorage.getItem('token')
    if (!token) {
      if (window.confirm('Để chọn và chỉnh sửa mẫu thiệp này, bạn cần đăng nhập tài khoản. Bạn có muốn chuyển đến trang đăng nhập ngay không?')) {
        navigate('/auth')
      }
      return
    }
    setShowSlugModal(true)
  }

  const handleConfirmCreate = async (slug) => {
    if (creating) return
    try {
      setCreating(true)
      const res = await api.createDraftInvitation(templateId, { slug })
      const invitation = res.data?.data || res.data
      navigate(`/editor/${invitation.id}`)
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Không tạo được thiệp')
    } finally {
      setCreating(false)
      setShowSlugModal(false)
    }
  }

  if (loading) {
    return (
      <div style={S.center}>
        <div style={S.loadingCard}>
          <IconEye size={32} color="#d97757" />
          <p style={{ marginTop: 12, fontSize: 14, color: '#5c524c', fontWeight: 500 }}>
            Đang tải bản xem trước mẫu thiệp...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={S.center}>
        <div style={{ ...S.loadingCard, borderColor: 'rgba(192,73,56,0.3)' }}>
          <p style={{ color: '#c04938', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>❌ {error}</p>
          <button style={S.btnBack} onClick={handleBack}>
            Quay lại Kho Mẫu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <header style={S.topbar}>
        <button style={S.backBtn} onClick={handleBack}>
          <IconChevronLeft size={16} />
          <span>Danh Sách Mẫu</span>
        </button>

        <div style={S.titleWrap}>
          <IconEye size={16} color="#c9a96e" />
          <span style={S.title}>Xem trước: {template?.template_name}</span>
        </div>

        <button style={S.createBtn} disabled={creating} onClick={handleUseTemplate}>
          {creating ? (
            <span>Đang tạo thiệp...</span>
          ) : (
            <>
              <IconSparkles size={16} />
              <span>Dùng Mẫu Này Ngay</span>
            </>
          )}
        </button>
      </header>

      <iframe
        srcDoc={template ? buildIframeDocument(html, { template }) : ''}
        style={S.iframe}
        sandbox="allow-scripts allow-same-origin allow-popups"
        title="Xem trước mẫu thiệp cưới"
      />

      {showSlugModal && (
        <ChangeSlugModal
          isOpen={showSlugModal}
          onClose={() => setShowSlugModal(false)}
          mode="create"
          onConfirmCreate={handleConfirmCreate}
        />
      )}
    </div>
  )
}

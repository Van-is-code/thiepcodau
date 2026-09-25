import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { buildIframeDocument, resolveTemplateUrl } from '../lib/templateEngine'
import { IconHeart, IconSparkles, IconAlertCircle, IconRefreshCw, IconChevronLeft } from './Icons'

const TemplateLoader = () => {
  const { slug } = useParams()
  const [invitation, setInvitation] = useState(null)
  const [templateContent, setTemplateContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadInvitation = async () => {
      try {
        setLoading(true)
        setError(null)

        // Try to get invitation by slug
        let invData = null
        try {
          const response = await api.getInvitationBySlug(slug)
          invData = response.data?.data || response.data
        } catch (err) {
          // If slug endpoint doesn't exist, try to get all and filter
          try {
            const response = await api.getInvitations()
            const invsData = Array.isArray(response.data?.data)
              ? response.data.data
              : Array.isArray(response.data)
              ? response.data
              : []
            invData = invsData.find((inv) => inv.invitation_slug === slug)
          } catch (fallbackErr) {
            throw err // Throw original error if fallback also fails
          }
        }

        if (!invData) {
          throw new Error(`Không tìm thấy thiệp cưới với đường dẫn: ${slug}`)
        }

        setInvitation(invData)

        // Mẫu thiệp được xác định qua invData.template (join sẵn từ BE)
        const templateUrl = resolveTemplateUrl(invData.template?.html_path)
        if (!templateUrl) {
          throw new Error('Thiệp này chưa được gán mẫu giao diện')
        }

        const htmlContent = await loadTemplateHTML(templateUrl)
        setTemplateContent(htmlContent)
      } catch (err) {
        console.error('Error loading invitation:', err)
        setError(err.message || 'Không thể tải thiệp cưới')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      loadInvitation()
    }
  }, [slug])

  // Điều hướng nội bộ giữa các file tĩnh trong cùng gói mẫu
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data || event.data.type !== 'wedding-web:navigate' || !event.data.file) return

      const baseUrl = resolveTemplateUrl(invitation?.template?.html_path)
      if (!baseUrl) return

      try {
        const fullBase = /^https?:\/\//i.test(baseUrl)
          ? baseUrl
          : (typeof window !== 'undefined' ? new URL(baseUrl, window.location.origin).href : baseUrl)
        const nextUrl = new URL(event.data.file, fullBase).href
        loadTemplateHTML(nextUrl)
          .then(setTemplateContent)
          .catch((err) => console.error('Error navigating within template:', err))
      } catch (err) {
        console.error('Error navigating within template:', err)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [invitation])

  const loadTemplateHTML = async (templateUrl) => {
    const response = await fetch(templateUrl, { cache: 'default' })
    if (!response.ok) {
      throw new Error(`Failed to load template: ${templateUrl}`)
    }
    return response.text()
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingCard}>
          <div style={styles.iconHeartWrap}>
            <IconHeart size={28} color="#fff" />
          </div>
          <h2 style={styles.loadingTitle}>Đang Mở Thiệp Cưới...</h2>
          <p style={styles.loadingSub}>Vui lòng chờ trong giây lát</p>
          <div style={styles.spinner}></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorContent}>
          <div style={styles.errorIconWrap}>
            <IconAlertCircle size={32} color="#c04938" />
          </div>
          <h2 style={styles.errorTitle}>Không Thể Mở Thiệp Cưới</h2>
          <p style={styles.errorMessage}>{error}</p>
          <div style={styles.errorHint}>
            <p style={{ fontWeight: 600, color: '#1f1917', marginBottom: 6 }}>💡 Gợi ý xử lý:</p>
            <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
              <li>Kiểm tra lại đường dẫn (slug) đã nhập chính xác chưa</li>
              <li>Kiểm tra kết nối mạng hoặc thử làm mới lại trang</li>
              <li>Liên hệ với cô dâu hoặc chú rể để nhận lại link thiệp mời</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => window.location.reload()} style={styles.reloadBtn}>
              <IconRefreshCw size={15} />
              <span>Tải Lại Trang</span>
            </button>
            <button onClick={() => window.history.back()} style={styles.backBtn}>
              <IconChevronLeft size={15} />
              <span>Quay Lại</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <iframe
      srcDoc={buildIframeDocument(templateContent, invitation)}
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        margin: 0,
        padding: 0,
        display: 'block',
      }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"
      title="Wedding Invitation"
    />
  )
}

const styles = {
  loadingContainer: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'radial-gradient(ellipse at center, #fdf7f2 0%, #f4e8dc 100%)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    padding: 20,
  },
  loadingCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid #ede5db',
    borderRadius: 24,
    padding: '40px 36px',
    textAlign: 'center',
    boxShadow: '0 16px 40px -8px rgba(31, 25, 23, 0.1)',
    maxWidth: 380,
    width: '100%',
  },
  iconHeartWrap: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    boxShadow: '0 4px 16px rgba(217, 119, 87, 0.35)',
  },
  loadingTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 26,
    fontWeight: 600,
    color: '#1f1917',
    marginBottom: 6,
  },
  loadingSub: {
    fontSize: 13.5,
    color: '#6e625c',
    marginBottom: 20,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid rgba(217, 119, 87, 0.15)',
    borderTopColor: '#d97757',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  errorContainer: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#fcfaf7',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    padding: 20,
  },
  errorContent: {
    textAlign: 'center',
    maxWidth: 480,
    width: '100%',
    padding: '36px 32px',
    background: '#fff',
    borderRadius: 24,
    boxShadow: '0 16px 40px -8px rgba(31, 25, 23, 0.1)',
    border: '1px solid #ede5db',
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(192, 73, 56, 0.1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  errorTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 26,
    fontWeight: 600,
    color: '#1f1917',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    marginBottom: 18,
    color: '#c04938',
    fontWeight: 500,
  },
  errorHint: {
    fontSize: 13,
    lineHeight: 1.7,
    color: '#5c524c',
    textAlign: 'left',
    background: '#f6f1eb',
    padding: '16px 18px',
    borderRadius: 14,
    marginBottom: 24,
    border: '1px solid #ede5db',
  },
  reloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 9999,
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 600,
    boxShadow: '0 4px 14px rgba(217, 119, 87, 0.35)',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    background: '#f6f1eb',
    color: '#1f1917',
    border: '1px solid #ede5db',
    borderRadius: 9999,
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 500,
  },
}

export default TemplateLoader

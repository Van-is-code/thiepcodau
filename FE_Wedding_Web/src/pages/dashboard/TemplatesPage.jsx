import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { toArray } from './helpers'
import {
  IconPalette,
  IconSparkles,
  IconEye,
  IconPlus,
} from '../../components/Icons'

const paletteClass = (index) => ['tp1', 'tp2', 'tp3', 'tp4'][index % 4]

const FALLBACK_TEMPLATES = [
  { id: 1, template_name: 'Đức Cương & Nguyễn Quyết' },
]

const STYLE_TEXT = [
  'LadiPage · Bìa phong bì mở ra thiệp',
]

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingId, setCreatingId] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await api.getTemplates()
        setTemplates(toArray(res.data))
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Không tải được danh sách template')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [])

  const cards = useMemo(() => (templates.length ? templates : FALLBACK_TEMPLATES), [templates])

  const handleCreate = async (tpl) => {
    if (creatingId) return
    try {
      setCreatingId(tpl.id)
      const res = await api.createDraftInvitation(tpl.id)
      const invitation = res.data?.data || res.data
      navigate(`/editor/${invitation.id}`)
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Không tạo được thiệp')
    } finally {
      setCreatingId('')
    }
  }

  return (
    <div className="pg">
      <div className="ph-row">
        <div>
          <p className="ph-ew">
            <IconPalette size={14} />
            Bộ Sưu Tập Mẫu
          </p>
          <h1 className="ph-t">Kho Mẫu Thiệp Cưới</h1>
          <p className="ph-d">Khám phá các thiết kế thiệp 9:16 chuẩn mobile, chọn mẫu và chỉnh sửa trực tiếp.</p>
        </div>
        <div className="quota-badge">
          <span>Tổng số:</span>
          <strong>{cards.length}</strong> mẫu
        </div>
      </div>

      {loading && (
        <div className="empty">
          <div className="empty-ico">
            <IconSparkles size={32} color="#d97757" />
          </div>
          <p className="empty-txt">Đang tải kho mẫu thiệp cưới...</p>
        </div>
      )}

      {error && (
        <div className="empty" style={{ borderColor: 'rgba(192,73,56,0.3)' }}>
          <p className="empty-txt" style={{ color: '#c04938' }}>Lỗi: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="tpl-grid">
          {cards.map((tpl, index) => (
            <article key={tpl.id} className="tpl-card">
              <div className={`tpl-prev ${paletteClass(index)}`}>
                <div className="tp-inner">
                  <div className="tp-ew">Wedding Invitation</div>
                  <div className="tp-names">
                    Tên Chú Rể
                    <span className="tp-amp">&</span>
                    Tên Cô Dâu
                  </div>
                  <div className="tp-div" />
                  <div className="tp-date">SAVE THE DATE</div>
                </div>
              </div>
              <div className="tpl-info">
                <div className="tpl-name">{tpl.template_name || `Mẫu Thiệp #${tpl.id}`}</div>
                <div className="tpl-style">{STYLE_TEXT[index % STYLE_TEXT.length]}</div>
                <div className="tpl-acts">
                  <button className="btn-sm ghost" onClick={() => navigate(`/preview/${tpl.id}`)}>
                    <IconEye size={14} />
                    <span>Xem Trước</span>
                  </button>
                  <button
                    className="btn-sm rose"
                    disabled={creatingId === tpl.id}
                    onClick={() => handleCreate(tpl)}
                  >
                    {creatingId === tpl.id ? (
                      <span>Đang tạo...</span>
                    ) : (
                      <>
                        <IconSparkles size={14} />
                        <span>Tạo Thiệp</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

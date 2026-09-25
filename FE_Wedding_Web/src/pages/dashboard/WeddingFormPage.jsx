import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { toArray } from './helpers'
import {
  IconMail,
  IconSparkles,
  IconUser,
  IconCalendar,
  IconMapPin,
  IconPalette,
  IconChevronLeft,
  IconPlus,
} from '../../components/Icons'

export default function WeddingFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedTemplateId = location.state?.templateId
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    title_vi: '',
    template_id: '',
    groom: '',
    bride: '',
    ceremony_date: '',
    venue_address: '',
  })

  useEffect(() => {
    document.title = 'Tạo Thiệp Cưới Mới — Wedding Invitation'
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        setLoadingTemplates(true)
        const res = await api.getTemplates()
        const data = toArray(res.data)
        setTemplates(data)

        const preselected =
          preselectedTemplateId && data.some((tpl) => String(tpl.id) === String(preselectedTemplateId))
            ? String(preselectedTemplateId)
            : data[0]?.id
            ? String(data[0].id)
            : ''

        if (preselected) {
          setForm((prev) => ({ ...prev, template_id: preselected }))
        }
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Không tải được danh sách template')
      } finally {
        setLoadingTemplates(false)
      }
    }

    run()
  }, [preselectedTemplateId])

  const selectedTemplate = useMemo(
    () => templates.find((item) => String(item.id) === String(form.template_id)),
    [templates, form.template_id],
  )

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.title_vi.trim() || !form.groom.trim() || !form.bride.trim()) {
      setError('Vui lòng nhập đầy đủ tiêu đề, tên chú rể và tên cô dâu.')
      return
    }

    if (!form.template_id) {
      setError('Vui lòng chọn template mẫu.')
      return
    }

    try {
      setSaving(true)
      await api.createInvitation({
        title_vi: form.title_vi.trim(),
        template_id: form.template_id,
        groom: form.groom.trim(),
        bride: form.bride.trim(),
        ceremony_date: form.ceremony_date || null,
        venue_address: form.venue_address.trim() || null,
      })

      setSuccess('Tạo thiệp thành công! Đang chuyển hướng về danh sách thiệp...')
      window.setTimeout(() => navigate('/dashboard'), 900)
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Tạo thiệp thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pg">
      <div className="ph-row">
        <div>
          <p className="ph-ew">
            <IconSparkles size={14} />
            Khởi Tạo Thiệp Mới
          </p>
          <h1 className="ph-t">Thông Tin Thiệp Cưới</h1>
          <p className="ph-d">Điền các thông tin cơ bản để khởi tạo thiệp cưới của bạn.</p>
        </div>
      </div>

      <form className="inv-panel" onSubmit={handleSubmit} style={{ maxWidth: '780px' }}>
        <div className="inv-ph">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconMail size={18} color="#d97757" />
            <div className="inv-pt">Thông Tin Lễ Cưới</div>
          </div>
          <div className="inv-ps">Sau khi tạo xong, bạn có thể chỉnh sửa trực tiếp nội dung & hình ảnh trên thiệp.</div>
        </div>

        <div className="inv-pb">
          {error && (
            <div className="empty" style={{ marginBottom: 16, color: '#c04938', borderColor: 'rgba(192,73,56,0.3)', padding: 14 }}>
              Lỗi: {error}
            </div>
          )}
          {success && (
            <div className="empty" style={{ marginBottom: 16, color: '#4f7e65', borderColor: 'rgba(79,126,101,0.3)', padding: 14 }}>
              {success}
            </div>
          )}

          <div className="fgrid">
            <div className="fld full">
              <label>Tiêu đề thiệp cưới</label>
              <input
                value={form.title_vi}
                onChange={(e) => updateField('title_vi', e.target.value)}
                placeholder="VD: Lễ Thành Hôn - Minh Anh & Thu Hà"
              />
            </div>

            <div className="fld">
              <label>Họ tên chú rể</label>
              <input
                value={form.groom}
                onChange={(e) => updateField('groom', e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div className="fld">
              <label>Họ tên cô dâu</label>
              <input
                value={form.bride}
                onChange={(e) => updateField('bride', e.target.value)}
                placeholder="Trần Thị B"
              />
            </div>

            <div className="fld">
              <label>Ngày & giờ tổ chức</label>
              <input
                type="datetime-local"
                value={form.ceremony_date}
                onChange={(e) => updateField('ceremony_date', e.target.value)}
              />
            </div>

            <div className="fld">
              <label>Mẫu giao diện (Template)</label>
              <select
                value={form.template_id}
                onChange={(e) => updateField('template_id', e.target.value)}
                disabled={loadingTemplates}
              >
                <option value="">Chọn mẫu thiệp...</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={String(tpl.id)}>
                    {tpl.template_name || tpl.name || `Template #${tpl.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="fld full">
              <label>Địa điểm tổ chức hôn lễ</label>
              <input
                value={form.venue_address}
                onChange={(e) => updateField('venue_address', e.target.value)}
                placeholder="VD: Trung tâm Tiệc cưới White Palace, Q. Phú Nhuận, TP.HCM"
              />
            </div>
          </div>

          <div className="savebar" style={{ marginTop: 20 }}>
            <button type="button" className="btn-ghost" onClick={() => navigate('/dashboard')}>
              <IconChevronLeft size={15} />
              <span>Quay Lại</span>
            </button>
            <button type="submit" className="btn-main" disabled={saving || loadingTemplates}>
              <IconPlus size={16} />
              <span>{saving ? 'Đang tạo thiệp...' : 'Tạo Thiệp Ngay'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

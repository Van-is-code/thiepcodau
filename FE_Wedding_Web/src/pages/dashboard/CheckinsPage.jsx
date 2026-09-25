import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import InvitationSelector from './InvitationSelector'
import { invitationName, normalizeCheckinStatus, toArray } from './helpers'
import {
  IconCheckSquare,
  IconDownload,
  IconSearch,
  IconRefreshCw,
  IconCheckCircle,
  IconX,
  IconHelpCircle,
  IconUsers,
  IconHeart,
  IconMessageCircle,
  IconCalendar,
  IconUser,
} from '../../components/Icons'

const STATUS_CFG = {
  yes: { cls: 'yes', Icon: IconCheckCircle, label: 'Sẽ đến' },
  no: { cls: 'no', Icon: IconX, label: 'Không đến' },
  maybe: { cls: 'maybe', Icon: IconHelpCircle, label: 'Chưa rõ' },
}

export default function CheckinsPage() {
  const [invitations, setInvitations] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [checkins, setCheckins] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeRow, setActiveRow] = useState(null)

  useEffect(() => {
    const loadInvitations = async () => {
      try {
        setLoading(true)
        const res = await api.getInvitations()
        const data = toArray(res.data)
        setInvitations(data)
        if (data[0]?.id) setSelectedId(String(data[0].id))
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Không tải được danh sách thiệp')
        setInvitations([])
        setSelectedId('')
      } finally {
        setLoading(false)
      }
    }
    loadInvitations()
  }, [])

  useEffect(() => {
    const loadCheckins = async () => {
      if (!selectedId) {
        setCheckins([])
        return
      }
      const res = await api.getCheckins(selectedId)
      setCheckins(toArray(res.data))
    }

    loadCheckins().catch(() => setCheckins([]))
  }, [selectedId])

  const filtered = useMemo(() => {
    return checkins.filter((item) => {
      const status = normalizeCheckinStatus(item)
      if (statusFilter !== 'all' && status !== statusFilter) return false
      const q = search.trim().toLowerCase()
      if (!q) return true
      const text = `${item.name || ''} ${item.content || item.message || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [checkins, search, statusFilter])

  const stats = useMemo(() => {
    const yes = checkins.filter((item) => normalizeCheckinStatus(item) === 'yes').length
    const no = checkins.filter((item) => normalizeCheckinStatus(item) === 'no').length
    return {
      total: checkins.length,
      yes,
      no,
      maybe: Math.max(checkins.length - yes - no, 0),
    }
  }, [checkins])

  const visible = useMemo(() => {
    return filtered.filter((item) => {
      if (fromDate && (item.date || '') < fromDate) return false
      if (toDate && (item.date || '') > toDate) return false
      return true
    })
  }, [filtered, fromDate, toDate])

  const exportCSV = () => {
    if (!visible.length) return
    const headers = ['Tên', 'Phản Hồi', 'Lời Nhắn', 'Số Người', 'Loại Khách', 'Ngày']
    const rows = visible.map((item) => [
      item.name || '',
      item.attending_status || item.attend || item.status || '',
      item.content || item.message || '',
      item.count || item.guests || 0,
      item.guests_type || '',
      item.date || '',
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }))
    link.download = `checkin-${String(
      invitationName(invitations.find((item) => String(item.id) === String(selectedId))) || 'wedding',
    )
      .replace(/\s+/g, '-')
      .toLowerCase()}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 600 }}>
        <div className="empty-ico">
          <IconCheckSquare size={32} color="#d97757" />
        </div>
        <p className="empty-txt">Đang tải danh sách xác nhận tham dự...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 600, borderColor: 'rgba(192,73,56,0.3)' }}>
        <p className="empty-txt" style={{ color: '#c04938' }}>Lỗi: {error}</p>
      </div>
    )
  }

  return (
    <div className="pg">
      <div className="ph-row">
        <div>
          <p className="ph-ew">
            <IconCheckSquare size={14} />
            Xác Nhận & Lời Chúc
          </p>
          <h1 className="ph-t">Danh Sách Xác Nhận (RSVP)</h1>
          <p className="ph-d">Thống kê số lượng khách tham dự, lời chúc phúc và danh sách phản hồi.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={exportCSV} disabled={!visible.length}>
          <IconDownload size={15} />
          <span>Xuất File CSV</span>
        </button>
      </div>

      <InvitationSelector invitations={invitations} selectedId={selectedId} onChange={setSelectedId} />

      {/* 4 Bento Metrics Cards */}
      <div className="ci-stats">
        <div className="ci-stat tot">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, color: 'var(--text-subtle)' }}>
            <IconUsers size={20} />
          </div>
          <div className="ci-val">{stats.total}</div>
          <div className="ci-lbl">Tổng Phản Hồi</div>
        </div>

        <div className="ci-stat yes">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, color: 'var(--sage)' }}>
            <IconCheckCircle size={20} />
          </div>
          <div className="ci-val" style={{ color: 'var(--sage)' }}>
            {stats.yes}
          </div>
          <div className="ci-lbl">Sẽ Đến Tham Dự</div>
        </div>

        <div className="ci-stat no">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, color: '#c04938' }}>
            <IconX size={20} />
          </div>
          <div className="ci-val" style={{ color: '#c04938' }}>
            {stats.no}
          </div>
          <div className="ci-lbl">Không Thể Đến</div>
        </div>

        <div className="ci-stat mb">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, color: 'var(--gold-dark)' }}>
            <IconHelpCircle size={20} />
          </div>
          <div className="ci-val" style={{ color: 'var(--gold-dark)' }}>
            {stats.maybe}
          </div>
          <div className="ci-lbl">Chưa Xác Định</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="ci-filter">
        <div className="ci-fbody">
          <div className="ci-ff" style={{ flex: '1 1 200px' }}>
            <label>Tìm kiếm khách / lời chúc</label>
            <div style={{ position: 'relative' }}>
              <input
                placeholder="Tên khách hoặc nội dung lời chúc…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-subtle)',
                  display: 'flex',
                }}
              >
                <IconSearch size={15} />
              </span>
            </div>
          </div>

          <div className="ci-ff">
            <label>Trạng Thái Tham Dự</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả phản hồi</option>
              <option value="yes">Sẽ đến</option>
              <option value="no">Không đến</option>
              <option value="maybe">Chưa rõ</option>
            </select>
          </div>

          <div className="ci-ff">
            <label>Từ Ngày</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="ci-ff">
            <label>Đến Ngày</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '8px 14px', fontSize: 12, borderRadius: 'var(--radius-md)' }}
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setFromDate('')
                setToDate('')
              }}
            >
              <IconRefreshCw size={13} />
              <span>Đặt lại</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', marginBottom: 12 }}>
        Hiển thị {visible.length} phản hồi
      </div>

      {/* Checkins Data Table */}
      <div className="ci-twrap">
        <div className="ci-thead">
          <div className="ci-th">Tên Khách Mời</div>
          <div className="ci-th">Trạng Thái</div>
          <div className="ci-th">Lời Chúc Phúc</div>
          <div className="ci-th">Số Người</div>
          <div className="ci-th">Ngày Gửi</div>
        </div>
        <div id="ci-table-body">
          {visible.length === 0 ? (
            <div className="empty" style={{ borderRadius: 0, border: 'none', padding: '48px 24px' }}>
              <div className="empty-ico">
                <IconMessageCircle size={36} color="#9e918a" />
              </div>
              <p className="empty-txt" style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                Chưa có phản hồi hoặc lời chúc nào
              </p>
              <p className="empty-txt" style={{ fontSize: 12.5, marginTop: 4 }}>
                Khi khách mời xác nhận qua thiệp, thông tin sẽ tự động hiển thị tại đây.
              </p>
            </div>
          ) : (
            visible.map((item) => {
              const status = normalizeCheckinStatus(item)
              const cfg = STATUS_CFG[status]
              const StatusIcon = cfg.Icon

              return (
                <div key={item.id} className="ci-row" onClick={() => setActiveRow(item)} role="button" tabIndex={0}>
                  <div className="ci-td">
                    <span className="ci-name">{item.name || 'Khách ẩn danh'}</span>
                  </div>
                  <div className="ci-td">
                    <span className={`ci-badge ${cfg.cls}`}>
                      <StatusIcon size={12} />
                      <span>{cfg.label}</span>
                    </span>
                  </div>
                  <div className="ci-td">
                    <span className="ci-msg">{item.content || item.message || '—'}</span>
                  </div>
                  <div className="ci-td" style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                    {item.count || item.guests || 0} người
                  </div>
                  <div className="ci-td" style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
                    {item.date || '—'}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Details Modal */}
      <div
        className={`ci-modal-ov${activeRow ? ' show' : ''}`}
        onClick={(event) => event.target === event.currentTarget && setActiveRow(null)}
      >
        <div className="ci-modal-box">
          <div className="ci-modal-top" />
          <div className="ci-modal-hd">
            <div>
              <div className="ci-modal-name">{activeRow?.name || 'Khách mời'}</div>
              <div style={{ marginTop: 8 }}>
                {activeRow && (
                  <span className={`ci-badge ${STATUS_CFG[normalizeCheckinStatus(activeRow)].cls}`}>
                    {React.createElement(STATUS_CFG[normalizeCheckinStatus(activeRow)].Icon, { size: 13 })}
                    <span>{STATUS_CFG[normalizeCheckinStatus(activeRow)].label}</span>
                  </span>
                )}
              </div>
            </div>
            <button className="ci-modal-x" onClick={() => setActiveRow(null)} aria-label="Đóng">
              <IconX size={15} />
            </button>
          </div>

          <div className="ci-modal-bd">
            <div className="ci-mrow">
              <div className="ci-mlbl">
                <IconMessageCircle size={12} /> Lời Chúc Phúc
              </div>
              <div className={`ci-mval${activeRow?.content || activeRow?.message ? '' : ' empty'}`}>
                {activeRow?.content || activeRow?.message || 'Khách không để lại lời nhắn'}
              </div>
            </div>

            <div className="ci-mval2g">
              <div className="ci-mrow">
                <div className="ci-mlbl">
                  <IconUsers size={12} /> Số Người Tham Dự
                </div>
                <div className="ci-mval">{activeRow?.count || activeRow?.guests || 0} người</div>
              </div>

              <div className="ci-mrow">
                <div className="ci-mlbl">
                  <IconUser size={12} /> Khách Mời Của
                </div>
                <div className={`ci-mval${activeRow?.guests_type ? '' : ' empty'}`}>
                  {activeRow?.guests_type || 'Nhà trai & Nhà gái'}
                </div>
              </div>
            </div>

            <div className="ci-mrow" style={{ marginTop: 4 }}>
              <div className="ci-mlbl">
                <IconCalendar size={12} /> Thời Gian Gửi
              </div>
              <div className="ci-mval">{activeRow?.date || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

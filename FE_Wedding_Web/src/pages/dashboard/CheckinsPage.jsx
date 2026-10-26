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
  IconChevronDown,
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [detailItem, setDetailItem] = useState(null)

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

  const loadCheckins = async (silent = false) => {
    if (!selectedId) {
      setCheckins([])
      return
    }
    try {
      if (!silent) setLoading(true)
      const res = await api.getCheckins(selectedId)
      const list = toArray(res.data)
      list.sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0))
      setCheckins(list)
    } catch (err) {
      if (!silent) {
        setError(err?.response?.data?.message || err.message || 'Không tải được danh sách phản hồi')
        setCheckins([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Tải phản hồi và tự động refresh ngầm (mỗi 5s khi tab active, không reload trang)
  useEffect(() => {
    loadCheckins(false)
    if (!selectedId) return

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadCheckins(true)
      }
    }, 3000)

    return () => clearInterval(intervalId)
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
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const encoded = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encoded)
    link.setAttribute('download', `danh-sach-phan-hoi-${selectedId || 'all'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading && invitations.length === 0) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 600 }}>
        <div className="empty-ico">
          <IconCheckSquare size={32} color="#d97757" />
        </div>
        <p className="empty-txt">Đang tải danh sách phản hồi...</p>
      </div>
    )
  }

  if (error && invitations.length === 0) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 600, borderColor: 'rgba(192,73,56,0.3)' }}>
        <p className="empty-txt" style={{ color: '#c04938' }}>Lỗi: {error}</p>
      </div>
    )
  }

  return (
    <div className="pg">
      <div className="ph-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <p className="ph-ew">
            <IconCheckSquare size={14} />
            Theo Dõi Khách Mời
          </p>
          <h1 className="ph-t">Phản Hồi & Điểm Danh</h1>
          <p className="ph-d">
            Cập nhật thời gian thực khi khách gửi lời chúc hoặc xác nhận tham dự. Tự động đồng bộ liên tục.
          </p>
        </div>
        <div className="checkins-header-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-main"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13.5 }}
            onClick={exportCSV}
            disabled={visible.length === 0}
          >
            <IconDownload size={14} />
            <span>Xuất Danh Sách CSV</span>
          </button>
        </div>
      </div>

      <InvitationSelector invitations={invitations} selectedId={selectedId} onChange={setSelectedId} />

      {/* Metric Cards */}
      <div className="ci-stats">
        <div className="ci-sc total">
          <div className="ci-sc-h">
            <span className="ci-sc-lbl">Tổng Phản Hồi</span>
            <span className="ci-sc-i"><IconUsers size={16} /></span>
          </div>
          <div className="ci-sc-v">{stats.total}</div>
          <div className="ci-sc-s">Lời chúc & xác nhận</div>
        </div>

        <div className="ci-sc yes">
          <div className="ci-sc-h">
            <span className="ci-sc-lbl">Sẽ Đến Tham Dự</span>
            <span className="ci-sc-i"><IconCheckCircle size={16} /></span>
          </div>
          <div className="ci-sc-v">{stats.yes}</div>
          <div className="ci-sc-s">
            {stats.total > 0 ? `${Math.round((stats.yes / stats.total) * 100)}% tổng số` : 'Chưa có'}
          </div>
        </div>

        <div className="ci-sc no">
          <div className="ci-sc-h">
            <span className="ci-sc-lbl">Không Thể Đến</span>
            <span className="ci-sc-i"><IconX size={16} /></span>
          </div>
          <div className="ci-sc-v">{stats.no}</div>
          <div className="ci-sc-s">
            {stats.total > 0 ? `${Math.round((stats.no / stats.total) * 100)}% tổng số` : 'Chưa có'}
          </div>
        </div>

        <div className="ci-sc maybe">
          <div className="ci-sc-h">
            <span className="ci-sc-lbl">Chưa Xác Nhận Rõ</span>
            <span className="ci-sc-i"><IconHelpCircle size={16} /></span>
          </div>
          <div className="ci-sc-v">{stats.maybe}</div>
          <div className="ci-sc-s">Cần liên hệ lại</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="ci-filter">
        <button
          type="button"
          className={`mobile-filter-toggle${mobileFiltersOpen ? ' open' : ''}`}
          onClick={() => setMobileFiltersOpen((open) => !open)}
          aria-expanded={mobileFiltersOpen}
        >
          <span>
            <strong>Bộ lọc phản hồi</strong>
            <small>{statusFilter === 'all' ? 'Tất cả trạng thái' : (STATUS_CFG[statusFilter]?.label || 'Đang lọc')}</small>
          </span>
          <IconChevronDown size={18} />
        </button>
        <div className={`ci-fbody${mobileFiltersOpen ? ' mobile-open' : ''}`}>
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
            <label>Từ ngày</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="ci-ff">
            <label>Đến ngày</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <button
              type="button"
              className="btn-sm ghost"
              style={{ height: 38 }}
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setFromDate('')
                setToDate('')
                loadCheckins(false)
              }}
              title="Đặt lại bộ lọc và tải lại danh sách"
            >
              <IconRefreshCw size={13} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      <div className="checkin-list-meta" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Hiển thị {visible.length} phản hồi</span>
        <span style={{ fontSize: 11.5, color: '#4f7e65', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4f7e65', display: 'inline-block' }} />
          Tự động đồng bộ ngầm
        </span>
      </div>

      {/* Checkins Data Table */}
      <div className="ci-twrap">
        <div className="ci-thead">
          <div className="ci-th">Khách Mời</div>
          <div className="ci-th">Xác Nhận Tham Dự</div>
          <div className="ci-th">Lời Chúc Mừng</div>
          <div className="ci-th">Đi Kèm</div>
          <div className="ci-th" style={{ textAlign: 'right' }}>Thời Gian</div>
        </div>

        <div id="checkins-table-body">
          {visible.length === 0 ? (
            <div className="empty" style={{ borderRadius: 0, border: 'none', padding: '48px 24px' }}>
              <div className="empty-ico">
                <IconMessageCircle size={36} color="#9e918a" />
              </div>
              <p className="empty-txt" style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                {search || statusFilter !== 'all' ? 'Không tìm thấy phản hồi phù hợp bộ lọc' : 'Chưa có phản hồi nào từ khách mời'}
              </p>
              <p className="empty-txt" style={{ fontSize: 12.5, marginTop: 4 }}>
                Khi khách mở thiệp cưới và gửi lời chúc hoặc chọn xác nhận tham dự, thông tin sẽ lập tức xuất hiện ở đây.
              </p>
            </div>
          ) : (
            visible.map((item) => {
              const statusKey = normalizeCheckinStatus(item)
              const cfg = STATUS_CFG[statusKey] || STATUS_CFG.maybe
              const Icon = cfg.Icon

              const guestName = item.name || item.name_guest || item.guest_name || 'Khách mời'
              const message = item.content || item.message || item.messages || ''
              const guestCount = item.count || item.number_of_attendees || item.guests || 1
              const timeDisplay = item.date || item.created_at ? new Date(item.date || item.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'

              return (
                <div
                  key={item.id}
                  className={`ci-row${activeRow === item.id ? ' active' : ''}`}
                  onClick={() => {
                    setActiveRow(item.id)
                    setDetailItem(item)
                  }}
                >
                  <div className="ci-td ci-person">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--primary-light)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12.5,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {guestName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 13.5 }}>{guestName}</div>
                        {item.guest_type && item.guest_type !== 'ca_hai' && (
                          <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                            {item.guest_type === 'nha_trai' ? 'Khách nhà trai' : 'Khách nhà gái'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ci-td" data-label="Xác nhận">
                    <span className={`ci-badge ${cfg.cls}`}>
                      <Icon size={13} />
                      <span>{cfg.label}</span>
                    </span>
                  </div>

                  <div className="ci-td" data-label="Lời chúc">
                    <div className="ci-msg" title={message}>
                      {message || <span style={{ color: 'var(--text-placeholder)', fontStyle: 'italic' }}>Không để lại lời nhắn</span>}
                    </div>
                  </div>

                  <div className="ci-td" data-label="Đi kèm">
                    <span style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>
                      {statusKey === 'no' ? '0 người' : `${guestCount} người`}
                    </span>
                  </div>

                  <div className="ci-td" data-label="Thời gian" style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-subtle)' }}>
                    {timeDisplay}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="mobile-checkin-list" aria-live="polite">
        {visible.length === 0 ? (
          <div className="mobile-empty-state">
            <div className="mobile-empty-icon"><IconMessageCircle size={26} /></div>
            <strong>Chưa có phản hồi phù hợp</strong>
            <span>Phản hồi của khách sẽ xuất hiện tại đây ngay khi gửi.</span>
          </div>
        ) : (
          visible.map((item) => {
            const statusKey = normalizeCheckinStatus(item)
            const cfg = STATUS_CFG[statusKey] || STATUS_CFG.maybe
            const StatusIcon = cfg.Icon
            const guestName = item.name || item.name_guest || item.guest_name || 'Khách mời'
            const message = item.content || item.message || item.messages || ''
            const guestCount = item.count || item.number_of_attendees || item.guests || 1
            const timeDisplay = item.date || item.created_at
              ? new Date(item.date || item.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
              : '—'

            return (
              <article
                className={`mobile-checkin-card ${cfg.cls}`}
                key={`mobile-${item.id}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveRow(item.id)
                  setDetailItem(item)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveRow(item.id)
                    setDetailItem(item)
                  }
                }}
              >
                <div className="mobile-checkin-head">
                  <div className="mobile-checkin-avatar">{guestName.charAt(0).toUpperCase()}</div>
                  <div className="mobile-checkin-name">
                    <strong>{guestName}</strong>
                    {item.guest_type && item.guest_type !== 'ca_hai' && (
                      <span>{item.guest_type === 'nha_trai' ? 'Khách nhà trai' : 'Khách nhà gái'}</span>
                    )}
                  </div>
                  <span className={`mobile-status-pill ${cfg.cls}`}><StatusIcon size={14} /> {cfg.label}</span>
                </div>

                {message && <div className="mobile-checkin-message">{message}</div>}

                <div className="mobile-checkin-footer">
                  <span><IconUsers size={15} /> {statusKey === 'no' ? 'Không tham dự' : `${guestCount} người tham dự`}</span>
                  <span><IconCalendar size={15} /> {timeDisplay}</span>
                </div>
              </article>
            )
          })
        )}
      </div>

      {detailItem && <CheckinDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  )
}

function CheckinDetailModal({ item, onClose }) {
  const statusKey = normalizeCheckinStatus(item)
  const cfg = STATUS_CFG[statusKey] || STATUS_CFG.maybe
  const StatusIcon = cfg.Icon
  const guestName = item.name || item.name_guest || item.guest_name || 'Khách mời'
  const message = item.content || item.message || item.messages || ''
  const guestCount = item.count || item.number_of_attendees || item.guests || 1
  const timeDisplay = item.date || item.created_at
    ? new Date(item.date || item.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  return (
    <div className="ci-modal-ov show" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ci-modal-box" role="dialog" aria-modal="true" aria-label={`Chi tiết phản hồi của ${guestName}`}>
        <div className="ci-modal-top" />
        <div className="ci-modal-hd">
          <div>
            <div className="ci-modal-name">{guestName}</div>
            <span className={`ci-badge ${cfg.cls}`}><StatusIcon size={14} /> {cfg.label}</span>
          </div>
          <button type="button" className="ci-modal-x" onClick={onClose} aria-label="Đóng chi tiết">
            <IconX size={17} />
          </button>
        </div>
        <div className="ci-modal-bd">
          <div className="ci-mrow">
            <div className="ci-mlbl">Lời chúc</div>
            <div className={`ci-mval${message ? '' : ' empty'}`}>{message || 'Khách chưa để lại lời chúc.'}</div>
          </div>
          <div className="ci-mrow ci-mval2g">
            <div>
              <div className="ci-mlbl">Số người</div>
              <div className="ci-mval">{statusKey === 'no' ? 'Không tham dự' : `${guestCount} người`}</div>
            </div>
            <div>
              <div className="ci-mlbl">Thời gian gửi</div>
              <div className="ci-mval">{timeDisplay}</div>
            </div>
          </div>
          {item.guest_type && item.guest_type !== 'ca_hai' && (
            <div className="ci-mrow">
              <div className="ci-mlbl">Nhóm khách</div>
              <div className="ci-mval">{item.guest_type === 'nha_trai' ? 'Khách nhà trai' : 'Khách nhà gái'}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

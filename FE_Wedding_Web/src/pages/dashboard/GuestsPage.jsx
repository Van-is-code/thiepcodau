import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import InvitationSelector from './InvitationSelector'
import { invitationName, invitationPublicUrl, toArray } from './helpers'
import {
  IconUsers,
  IconSearch,
  IconCopy,
  IconCheck,
  IconSend,
  IconExternalLink,
  IconSparkles,
  IconPlus,
} from '../../components/Icons'

export default function GuestsPage() {
  const [invitations, setInvitations] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [guests, setGuests] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')

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
    const loadGuests = async () => {
      if (!selectedId) {
        setGuests([])
        return
      }
      const res = await api.getGuests(selectedId)
      setGuests(toArray(res.data))
    }

    loadGuests().catch(() => setGuests([]))
  }, [selectedId])

  const invitation = useMemo(
    () => invitations.find((item) => String(item.id) === String(selectedId)),
    [invitations, selectedId],
  )

  const invitationLabel = useMemo(() => invitationName(invitation), [invitation])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return guests
    return guests.filter((g) => {
      const combined = `${g.name || ''} ${g.note || ''}`.toLowerCase()
      return combined.includes(q)
    })
  }, [guests, search])

  const handleCopyUrl = (url, id) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 1800)
  }

  if (loading) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 600 }}>
        <div className="empty-ico">
          <IconUsers size={32} color="#d97757" />
        </div>
        <p className="empty-txt">Đang tải danh sách khách mời...</p>
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
            <IconUsers size={14} />
            Danh Sách Khách Mời
          </p>
          <h1 className="ph-t">Quản Lý Khách Mời</h1>
          <p className="ph-d">Theo dõi danh sách khách mời cá nhân hoá và gửi link thiệp trực tiếp.</p>
        </div>
        <div className="quota-badge">
          <span>Tổng số:</span>
          <strong>{guests.length}</strong> khách
        </div>
      </div>

      <InvitationSelector invitations={invitations} selectedId={selectedId} onChange={setSelectedId} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-subtle)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <IconSearch size={16} />
          </span>
          <input
            id="guest-search"
            style={{
              width: '100%',
              paddingLeft: 40,
              paddingRight: 14,
              height: 42,
              background: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13.5,
              outline: 'none',
              color: 'var(--text-main)',
              boxShadow: 'var(--shadow-sm)',
            }}
            placeholder={`Tìm kiếm tên khách hoặc ghi chú trong thiệp ${invitationLabel || ''}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
          {filtered.length} kết quả
        </span>
      </div>

      <div className="gt-wrap">
        <div className="gt-head">
          <div className="gt-th">Tên Khách Mời</div>
          <div className="gt-th">Ghi Chú / Vai Trò</div>
          <div className="gt-th">Link Thiệp Cá Nhân Hoá</div>
          <div className="gt-th" style={{ textAlign: 'right' }}>Thao Tác</div>
        </div>
        <div id="guest-table-body">
          {filtered.length === 0 ? (
            <div className="empty" style={{ borderRadius: 0, border: 'none', padding: '48px 24px' }}>
              <div className="empty-ico">
                <IconUsers size={36} color="#9e918a" />
              </div>
              <p className="empty-txt" style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                Chưa có khách mời nào trong danh sách này
              </p>
              <p className="empty-txt" style={{ fontSize: 12.5, marginTop: 4 }}>
                Hãy sang trang "Tạo Link Mời" để tạo thiệp cá nhân hoá cho từng vị khách của bạn.
              </p>
            </div>
          ) : (
            filtered.map((g) => {
              const slug = String(g.name || '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
              const personalUrl =
                g.url || `${invitationPublicUrl(invitation)}?guest=${slug || encodeURIComponent(g.name || '')}`
              const isCopied = copiedId === String(g.id)

              return (
                <div key={g.id} className="gt-row">
                  <div className="gt-td">
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
                        {String(g.name || 'K').charAt(0).toUpperCase()}
                      </div>
                      <span className="gt-name">{g.name || 'Khách mời'}</span>
                    </div>
                  </div>

                  <div className="gt-td">
                    <span className="gt-note">
                      {g.note ? (
                        g.note
                      ) : (
                        <span style={{ color: 'var(--text-placeholder)', fontStyle: 'italic' }}>—</span>
                      )}
                    </span>
                  </div>

                  <div className="gt-td">
                    <span className="gt-url">{personalUrl}</span>
                  </div>

                  <div className="gt-td" style={{ textAlign: 'right' }}>
                    <div className="gt-acts" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn-sm ghost"
                        onClick={() => handleCopyUrl(personalUrl, String(g.id))}
                      >
                        {isCopied ? (
                          <>
                            <IconCheck size={13} color="#4f7e65" />
                            <span style={{ color: '#4f7e65' }}>Đã copy</span>
                          </>
                        ) : (
                          <>
                            <IconCopy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn-sm rose"
                        onClick={() => window.open(personalUrl, '_blank', 'noopener,noreferrer')}
                      >
                        <IconExternalLink size={13} />
                        <span>Mở Thiệp</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

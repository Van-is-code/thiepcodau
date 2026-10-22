import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import InvitationSelector from './InvitationSelector'
import { invitationName, invitationPublicUrl, toArray } from './helpers'
import QuickShareModal from './QuickShareModal'
import {
  IconUsers,
  IconSearch,
  IconExternalLink,
  IconPlus,
  IconTrash2,
  IconX,
  IconSend,
} from '../../components/Icons'

export default function GuestsPage() {
  const [invitations, setInvitations] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [guests, setGuests] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sharePayload, setSharePayload] = useState(null)

  // Modal thêm khách mới
  const [showAddModal, setShowAddModal] = useState(false)
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestNote, setNewGuestNote] = useState('')
  const [addingGuest, setAddingGuest] = useState(false)

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

  const reloadGuests = async (silent = false) => {
    if (!selectedId) {
      setGuests([])
      return
    }
    try {
      if (!silent) setLoading(true)
      const res = await api.getGuests(selectedId)
      setGuests(toArray(res.data))
    } catch {
      if (!silent) setGuests([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Tải danh sách khách và kích hoạt auto-refresh ngầm (polling mỗi 6s không load lại trang)
  useEffect(() => {
    reloadGuests(false)
    if (!selectedId) return

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        reloadGuests(true)
      }
    }, 6000)

    return () => clearInterval(intervalId)
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
      const combined = `${g.name || ''} ${g.note || ''} ${g.description || ''}`.toLowerCase()
      return combined.includes(q)
    })
  }, [guests, search])

  const getPersonalUrl = (g) => {
    if (g?.privateInvitation?.url) {
      return `${window.location.origin}${g.privateInvitation.url}`
    }
    if (g?.url) return g.url
    const base = invitation ? invitationPublicUrl(invitation) : ''
    return `${base}?to=${encodeURIComponent(g?.name || '')}`
  }

  const openShare = (url, name) => {
    if (!url) return
    setSharePayload({ url, name: name || '' })
  }

  const closeShare = () => setSharePayload(null)

  const handleDeleteGuest = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá khách mời "${name || 'này'}" không?`)) return
    try {
      await api.deleteGuest(id)
      setGuests((prev) => prev.filter((g) => g.id !== id))
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'Xoá khách mời thất bại')
    }
  }

  const handleAddGuest = async (e) => {
    e && e.preventDefault()
    const trimmed = newGuestName.trim()
    if (!trimmed) {
      alert('Vui lòng nhập tên khách mời')
      return
    }
    if (!selectedId) {
      alert('Vui lòng chọn một thiệp cưới')
      return
    }

    setAddingGuest(true)
    try {
      const res = await api.createGuest({
        name: trimmed,
        description: newGuestNote.trim() || null,
        invitation_id: selectedId,
      })
      const created = res.data?.data || res.data
      setGuests((prev) => [created, ...prev])
      setNewGuestName('')
      setNewGuestNote('')
      setShowAddModal(false)
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Không thể tạo khách mời')
    } finally {
      setAddingGuest(false)
    }
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
      <div className="ph-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <p className="ph-ew">
            <IconUsers size={14} />
            Danh Sách Khách Mời
          </p>
          <h1 className="ph-t">Quản Lý Khách Mời</h1>
          <p className="ph-d">Theo dõi danh sách khách mời cá nhân hoá và gửi link mời nhanh qua Messenger, Zalo.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="quota-badge">
            <span>Tổng số:</span>
            <strong>{guests.length}</strong> khách
          </div>
          <button
            type="button"
            className="btn-main"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13.5 }}
            onClick={() => setShowAddModal(true)}
          >
            <IconPlus size={14} />
            <span>Thêm Khách Mới</span>
          </button>
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
          <div className="gt-th" style={{ textAlign: 'right', minWidth: 220 }}>Mời Nhanh & Thao Tác</div>
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
                Bấm nút "Thêm Khách Mới" ở trên hoặc sang trang "Tạo Link Mời" để tạo thiệp cho từng vị khách.
              </p>
            </div>
          ) : (
            filtered.map((g) => {
              const personalUrl = getPersonalUrl(g)
              const noteText = g.description || g.note || ''

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
                      {noteText ? (
                        noteText
                      ) : (
                        <span style={{ color: 'var(--text-placeholder)', fontStyle: 'italic' }}>—</span>
                      )}
                    </span>
                  </div>

                  <div className="gt-td">
                    <span className="gt-url" title={personalUrl}>{personalUrl}</span>
                  </div>

                  <div className="gt-td" style={{ textAlign: 'right' }}>
                    <div className="gt-acts" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                      {/* Nút Mời Nhanh -> mở popup Messenger, Zalo, Copy Link */}
                      <button
                        type="button"
                        className="btn-quick-invite-sm"
                        onClick={() => openShare(personalUrl, g.name)}
                        title="Mời nhanh qua Messenger, Zalo hoặc Copy link"
                      >
                        <IconSend size={13} />
                        <span>Mời Nhanh</span>
                      </button>

                      {/* Mở Thiệp */}
                      <button
                        type="button"
                        className="btn-sm rose"
                        onClick={() => window.open(personalUrl, '_blank', 'noopener,noreferrer')}
                        title="Mở xem thiệp riêng của khách này"
                      >
                        <IconExternalLink size={13} />
                        <span>Mở</span>
                      </button>

                      {/* Xoá khách */}
                      <button
                        type="button"
                        style={{
                          border: 'none',
                          background: '#feebe8',
                          color: '#c0392b',
                          borderRadius: 6,
                          width: 28,
                          height: 28,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleDeleteGuest(g.id, g.name)}
                        title="Xoá khách này"
                      >
                        <IconTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal Mời Nhanh */}
      <QuickShareModal
        isOpen={!!sharePayload}
        onClose={closeShare}
        url={sharePayload?.url}
        recipientName={sharePayload?.name}
      />

      {/* Modal Thêm Khách Mời Nhanh */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(31,25,23,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: '24px 28px',
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1f1917' }}>Thêm Khách Mời Mới</div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6e625c' }}
              >
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={handleAddGuest}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#443731', marginBottom: 6 }}>
                  Tên khách mời *
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #d4c8be',
                    borderRadius: 10,
                    fontSize: 14,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="VD: Anh Tuấn, Cô Linh, Bạn Nam…"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#443731', marginBottom: 6 }}>
                  Ghi chú / Mối quan hệ (tuỳ chọn)
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #d4c8be',
                    borderRadius: 10,
                    fontSize: 14,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="Bạn cấp 3, đồng nghiệp, người thân…"
                  value={newGuestNote}
                  onChange={(e) => setNewGuestNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: '1px solid #d4c8be',
                    background: '#f9f6f2',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={addingGuest}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #e58d6f, #c96547)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {addingGuest ? 'Đang tạo…' : 'Tạo Khách Mời'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

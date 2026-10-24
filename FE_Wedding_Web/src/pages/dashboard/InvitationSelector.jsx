import React, { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconCheck, IconMail } from '../../components/Icons'

const getInvDisplayName = (inv) => {
  if (!inv) return 'Chọn thiệp cưới'
  const groom = inv.groom?.name_groom || inv.groom_name || (typeof inv.groom === 'string' ? inv.groom : '') || ''
  const bride = inv.bride?.name_bride || inv.bride_name || (typeof inv.bride === 'string' ? inv.bride : '') || ''
  if (groom && bride) return `${groom} & ${bride}`
  if (groom) return groom
  if (bride) return bride
  return inv.title_vi || inv.title || 'Thiệp cưới'
}

export default function InvitationSelector({ invitations, selectedId, onChange }) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const current = invitations.find((item) => String(item.id) === String(selectedId))

  return (
    <div className="inv-sel" ref={rootRef}>
      <span className="inv-sel-lbl">Chọn Thiệp:</span>
      <div className="inv-sel-drop">
        <button
          type="button"
          className={`inv-sel-btn${open ? ' open' : ''}`}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="inv-sel-dot" />
          <span className="isd-name">{getInvDisplayName(current)}</span>
          <span className="isd-arrow">
            <IconChevronDown size={14} />
          </span>
        </button>
        <div className={`inv-sel-menu${open ? ' show' : ''}`}>
          {invitations.map((inv) => {
            const isChosen = String(inv.id) === String(selectedId)
            const name = getInvDisplayName(inv)
            return (
              <button
                key={inv.id}
                type="button"
                className={`inv-sel-opt${isChosen ? ' chosen' : ''}`}
                onClick={() => {
                  onChange?.(String(inv.id))
                  setOpen(false)
                }}
              >
                <span className="iso-dot" />
                <span className="iso-body">
                  <span className="iso-name">{name}</span>
                  <span className="iso-date">/{inv.invitation_slug || inv.slug || ''}</span>
                </span>
                {isChosen && (
                  <span className="iso-check">
                    <IconCheck size={14} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
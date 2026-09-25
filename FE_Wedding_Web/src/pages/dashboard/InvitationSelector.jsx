import React, { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconCheck, IconMail } from '../../components/Icons'

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
          <span className="isd-name">
            {current
              ? `${current.groom?.name_groom || current.groom || ''} & ${current.bride?.name_bride || current.bride || ''}`.trim() ||
                current.title_vi ||
                'Thiệp cưới'
              : 'Chọn thiệp cưới'}
          </span>
          <span className="isd-arrow">
            <IconChevronDown size={14} />
          </span>
        </button>
        <div className={`inv-sel-menu${open ? ' show' : ''}`}>
          {invitations.map((inv) => {
            const isChosen = String(inv.id) === String(selectedId)
            const name =
              `${inv.groom?.name_groom || inv.groom || ''} & ${inv.bride?.name_bride || inv.bride || ''}`.trim() ||
              inv.title_vi ||
              'Thiệp cưới'
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
                  <span className="iso-date">/{inv.slug || inv.invitation_slug || ''}</span>
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
export const DEFAULT_PUBLIC_SHARE_TITLE = 'Thiệp cưới'
export const DEFAULT_PRIVATE_SHARE_TITLE = 'Mời {guest_name} đến chung vui cùng chúng tớ'
export const DEFAULT_PUBLIC_SHARE_DESCRIPTION = 'Trân trọng kính mời bạn đến chung vui cùng chúng tôi.'
export const DEFAULT_PRIVATE_SHARE_DESCRIPTION = 'Trân trọng kính mời {guest_name} đến chung vui cùng chúng tôi.'

const cleanText = (value) => String(value || '').trim()

const getCoupleNames = (invitation) => (
  cleanText(invitation?.extra_data?.couple_names) ||
  [cleanText(invitation?.groom?.name_groom), cleanText(invitation?.bride?.name_bride)].filter(Boolean).join(' & ')
)

const getFormattedDate = (invitation) => {
  const dateRaw = invitation?.ceremony_date || invitation?.reception_date
  if (!dateRaw) return ''
  try {
    const d = new Date(dateRaw)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch (_) {
    return ''
  }
}

export const publicShareTitle = (invitation) => {
  const custom = cleanText(invitation?.extra_data?.share_title_public)
  if (custom) return custom
  const names = getCoupleNames(invitation)
  if (names) return `${names} Wedding site!`
  return (
    cleanText(invitation?.title_vi) ||
    cleanText(invitation?.title) ||
    DEFAULT_PUBLIC_SHARE_TITLE
  )
}

export const privateShareTitleTemplate = (invitation) => {
  const custom = cleanText(invitation?.extra_data?.share_title_private)
  if (custom) return custom
  const names = getCoupleNames(invitation)
  return names ? `Mời {guest_name} đến chung vui cùng ${names}` : DEFAULT_PRIVATE_SHARE_TITLE
}

export const privateShareTitle = (invitation, guestName) => {
  const name = cleanText(guestName) || 'bạn'
  return privateShareTitleTemplate(invitation)
    .replaceAll('{guest_name}', name)
    .replaceAll('{name}', name)
}

export const publicShareDescription = (invitation) => {
  const custom = cleanText(invitation?.extra_data?.share_description_public)
  if (custom) return custom
  const names = getCoupleNames(invitation)
  const date = getFormattedDate(invitation)
  const quote = cleanText(invitation?.thank_you_message || invitation?.extra_notes) || DEFAULT_PUBLIC_SHARE_DESCRIPTION
  if (names) {
    return date ? `${names} - Our wedding date: ${date} | ${quote}` : `${names} | ${quote}`
  }
  return quote
}

export const privateShareDescriptionTemplate = (invitation) => {
  const custom = cleanText(invitation?.extra_data?.share_description_private)
  if (custom) return custom
  const names = getCoupleNames(invitation)
  const date = getFormattedDate(invitation)
  if (names) {
    return date
      ? `Trân trọng kính mời {guest_name} đến chung vui cùng ${names} vào ngày ${date}. Sự hiện diện của {guest_name} là niềm hạnh phúc to lớn của gia đình chúng tôi!`
      : `Trân trọng kính mời {guest_name} đến chung vui cùng ${names}. Sự hiện diện của {guest_name} là niềm hạnh phúc to lớn của gia đình chúng tôi!`
  }
  return DEFAULT_PRIVATE_SHARE_DESCRIPTION
}

export const privateShareDescription = (invitation, guestName) => {
  const name = cleanText(guestName) || 'bạn'
  return privateShareDescriptionTemplate(invitation)
    .replaceAll('{guest_name}', name)
    .replaceAll('{name}', name)
}

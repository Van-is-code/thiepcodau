export const DEFAULT_PUBLIC_SHARE_TITLE = 'Thiệp cưới'
export const DEFAULT_PRIVATE_SHARE_TITLE = 'Mời {guest_name} đến chung vui cùng chúng tớ'
export const DEFAULT_PUBLIC_SHARE_DESCRIPTION = 'Trân trọng kính mời bạn đến chung vui cùng chúng tôi.'
export const DEFAULT_PRIVATE_SHARE_DESCRIPTION = 'Trân trọng kính mời {guest_name} đến chung vui cùng chúng tôi.'

const cleanText = (value) => String(value || '').trim()

export const publicShareTitle = (invitation) => (
  cleanText(invitation?.extra_data?.share_title_public) ||
  cleanText(invitation?.title_vi) ||
  cleanText(invitation?.title) ||
  DEFAULT_PUBLIC_SHARE_TITLE
)

export const privateShareTitleTemplate = (invitation) => (
  cleanText(invitation?.extra_data?.share_title_private) || DEFAULT_PRIVATE_SHARE_TITLE
)

export const privateShareTitle = (invitation, guestName) => {
  const name = cleanText(guestName) || 'bạn'
  return privateShareTitleTemplate(invitation)
    .replaceAll('{guest_name}', name)
    .replaceAll('{name}', name)
}

export const publicShareDescription = (invitation) => (
  cleanText(invitation?.extra_data?.share_description_public) || DEFAULT_PUBLIC_SHARE_DESCRIPTION
)

export const privateShareDescriptionTemplate = (invitation) => (
  cleanText(invitation?.extra_data?.share_description_private) || DEFAULT_PRIVATE_SHARE_DESCRIPTION
)

export const privateShareDescription = (invitation, guestName) => {
  const name = cleanText(guestName) || 'bạn'
  return privateShareDescriptionTemplate(invitation)
    .replaceAll('{guest_name}', name)
    .replaceAll('{name}', name)
}

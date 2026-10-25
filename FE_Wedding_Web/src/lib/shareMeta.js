export const DEFAULT_PUBLIC_SHARE_TITLE = 'Thiệp cưới'
export const DEFAULT_PRIVATE_SHARE_TITLE = 'Mời {guest_name} đến chung vui cùng chúng tớ'

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

const { randomUUID } = require('crypto');

function slugifyVietnamese(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function createInvitationPath(name) {
  const base = slugifyVietnamese(name) || 'guest';
  const shortUuid = randomUUID().split('-')[0];
  return `/thiepmoi/${base}-${shortUuid}`;
}

function buildAbsoluteUrl(basePublicUrl, path) {
  const normalizedBase = basePublicUrl.replace(/\/$/, '');
  return `${normalizedBase}${path}`;
}

module.exports = {
  slugifyVietnamese,
  createInvitationPath,
  buildAbsoluteUrl,
};
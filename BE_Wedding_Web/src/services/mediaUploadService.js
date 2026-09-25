const streamifier = require('streamifier');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const cloudinary = require('../config/cloudinary');
const { Invitation } = require('../models');

const ensureCloudinaryEnv = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    const error = new Error('Thiếu cấu hình Cloudinary trong biến môi trường');
    error.status = 500;
    throw error;
  }
};

const uploadBuffer = (buffer, options) => new Promise((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(result);
  });

  streamifier.createReadStream(buffer).pipe(uploadStream);
});

const allowedResourceTypes = ['image', 'video'];

const normalizeResourceType = (resourceType) => {
  const type = (resourceType || 'image').toLowerCase();
  if (!allowedResourceTypes.includes(type)) {
    const error = new Error('resourceType chỉ hỗ trợ image hoặc video');
    error.status = 400;
    throw error;
  }
  return type;
};

const normalizePublicId = (publicId) => {
  if (!publicId) {
    const error = new Error('publicId là bắt buộc');
    error.status = 400;
    throw error;
  }
  return decodeURIComponent(publicId);
};

const mapMedia = (result) => ({
  publicId: result.public_id,
  url: result.secure_url,
  format: result.format,
  resourceType: result.resource_type,
  bytes: result.bytes,
  width: result.width,
  height: result.height,
  duration: result.duration,
  createdAt: result.created_at,
  folder: result.folder,
  tags: result.tags || []
});

const parseTags = (tags) => {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags;
  return String(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const createMedia = async ({ file, resourceType, folder, tags }) => {
  if (!file) {
    const error = new Error('Vui lòng gửi file');
    error.status = 400;
    throw error;
  }

  ensureCloudinaryEnv();

  const normalizedType = normalizeResourceType(resourceType);

  const result = await uploadBuffer(file.buffer, {
    folder: folder || (normalizedType === 'image' ? 'wedding/images' : 'wedding/videos'),
    resource_type: normalizedType,
    tags: parseTags(tags)
  });

  return mapMedia(result);
};

const listMedia = async ({ resourceType, maxResults, nextCursor, prefix }) => {
  ensureCloudinaryEnv();

  const normalizedType = normalizeResourceType(resourceType);
  const limit = Number.parseInt(maxResults, 10) || 20;

  const result = await cloudinary.api.resources({
    type: 'upload',
    resource_type: normalizedType,
    max_results: limit,
    next_cursor: nextCursor,
    prefix
  });

  return {
    items: (result.resources || []).map(mapMedia),
    nextCursor: result.next_cursor || null
  };
};

const getMediaByPublicId = async ({ publicId, resourceType }) => {
  ensureCloudinaryEnv();

  const normalizedType = normalizeResourceType(resourceType);
  const normalizedPublicId = normalizePublicId(publicId);

  try {
    const result = await cloudinary.api.resource(normalizedPublicId, {
      resource_type: normalizedType,
      type: 'upload'
    });

    return mapMedia(result);
  } catch (error) {
    if (error?.http_code === 404) {
      const notFoundError = new Error('Không tìm thấy media');
      notFoundError.status = 404;
      throw notFoundError;
    }
    throw error;
  }
};

const updateMedia = async ({ publicId, resourceType, file, tags, folder, newPublicId }) => {
  ensureCloudinaryEnv();

  const normalizedType = normalizeResourceType(resourceType);
  let currentPublicId = normalizePublicId(publicId);

  await getMediaByPublicId({ publicId: currentPublicId, resourceType: normalizedType });

  if (file) {
    const replaced = await uploadBuffer(file.buffer, {
      public_id: currentPublicId,
      overwrite: true,
      invalidate: true,
      resource_type: normalizedType,
      folder: folder || undefined,
      tags: parseTags(tags)
    });
    currentPublicId = replaced.public_id;
  }

  if (newPublicId && newPublicId !== currentPublicId) {
    const renamed = await cloudinary.uploader.rename(currentPublicId, newPublicId, {
      resource_type: normalizedType,
      type: 'upload',
      overwrite: true,
      invalidate: true
    });
    currentPublicId = renamed.public_id;
  }

  if (tags && !file) {
    await cloudinary.uploader.explicit(currentPublicId, {
      type: 'upload',
      resource_type: normalizedType,
      tags: parseTags(tags)
    });
  }

  return getMediaByPublicId({ publicId: currentPublicId, resourceType: normalizedType });
};

const deleteMedia = async ({ publicId, resourceType }) => {
  ensureCloudinaryEnv();

  const normalizedType = normalizeResourceType(resourceType);
  const normalizedPublicId = normalizePublicId(publicId);

  const result = await cloudinary.uploader.destroy(normalizedPublicId, {
    resource_type: normalizedType,
    type: 'upload',
    invalidate: true
  });

  if (result.result !== 'ok' && result.result !== 'not found') {
    const error = new Error('Xóa media thất bại');
    error.status = 500;
    throw error;
  }

  return {
    publicId: normalizedPublicId,
    resourceType: normalizedType,
    result: result.result
  };
};

const uploadImage = async (file) => createMedia({ file, resourceType: 'image' });
const uploadMusic = async (file) => createMedia({ file, resourceType: 'video' });

const uploadMusicLocal = async (file, userId, invitationId) => {
  if (!userId) {
    const error = new Error('Thiếu thông tin user từ token');
    error.status = 401;
    throw error;
  }

  if (!invitationId) {
    const error = new Error('invitation_id là bắt buộc');
    error.status = 400;
    throw error;
  }

  const invitation = await Invitation.findByPk(invitationId);
  if (!invitation) {
    const error = new Error('invitation_id không tồn tại');
    error.status = 400;
    throw error;
  }

  if (invitation.users_id !== userId) {
    const error = new Error('Bạn không có quyền cập nhật nhạc cho invitation này');
    error.status = 403;
    throw error;
  }

  if (!file) {
    const error = new Error('Vui lòng gửi file nhạc');
    error.status = 400;
    throw error;
  }

  // Đuôi tệp do uploadGuard suy ra từ magic bytes, KHÔNG lấy từ originalname.
  // Trước đây "nhac.html" sẽ được lưu thành .html rồi phục vụ tĩnh tại /uploads
  // -> trang HTML chạy được trên chính domain API (XSS lưu trữ, đọc token người khác).
  const ALLOWED_AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm']);
  const safeExt = ALLOWED_AUDIO_EXT.has(file.safeExt) ? file.safeExt : '.mp3';
  const folderPath = path.join(process.cwd(), 'uploads', 'music', String(userId));
  fs.mkdirSync(folderPath, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}${safeExt}`;
  const absolutePath = path.join(folderPath, fileName);
  fs.writeFileSync(absolutePath, file.buffer);

  const relativePath = path.posix.join('uploads', 'music', String(userId), fileName);
  const musicUrl = `/${relativePath}`;

  // CỐ Ý không gán thẳng vào invitation.music_url ở đây.
  //
  // Đường này chỉ LƯU TỆP. Việc gắn nhạc vào thiệp đi qua PATCH /invitations/:id/music,
  // nơi có đủ kiểm tra: thiệp đã khoá chưa, khách đã kích hoạt chưa, và bản nhạc
  // có thuộc tài khoản này không. Gán tắt ở đây là đi vòng qua hết những thứ đó —
  // thiệp quá hạn sửa vẫn đổi được nhạc.
  return {
    userId,
    invitationId,
    fileName,
    url: musicUrl
  };
};

module.exports = {
  createMedia,
  listMedia,
  getMediaByPublicId,
  updateMedia,
  deleteMedia,
  uploadImage,
  uploadMusic,
  uploadMusicLocal
};

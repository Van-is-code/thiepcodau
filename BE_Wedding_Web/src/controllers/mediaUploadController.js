const mediaUploadService = require('../services/mediaUploadService');

const createMedia = async (req, res) => {
  try {
    const data = await mediaUploadService.createMedia({
      file: req.file,
      resourceType: req.body.resourceType,
      folder: req.body.folder,
      tags: req.body.tags
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo media thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Tạo media thất bại'
    });
  }
};

const listMedia = async (req, res) => {
  try {
    const data = await mediaUploadService.listMedia({
      resourceType: req.query.resourceType,
      maxResults: req.query.maxResults,
      nextCursor: req.query.nextCursor,
      prefix: req.query.prefix
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách media thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lấy danh sách media thất bại'
    });
  }
};

const getMediaByPublicId = async (req, res) => {
  try {
    const data = await mediaUploadService.getMediaByPublicId({
      publicId: req.query.publicId,
      resourceType: req.query.resourceType
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy media thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lấy media thất bại'
    });
  }
};

const updateMedia = async (req, res) => {
  try {
    const data = await mediaUploadService.updateMedia({
      publicId: req.query.publicId,
      resourceType: req.body.resourceType || req.query.resourceType,
      file: req.file,
      tags: req.body.tags,
      folder: req.body.folder,
      newPublicId: req.body.newPublicId
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật media thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Cập nhật media thất bại'
    });
  }
};

const deleteMedia = async (req, res) => {
  try {
    const data = await mediaUploadService.deleteMedia({
      publicId: req.query.publicId,
      resourceType: req.query.resourceType
    });

    return res.status(200).json({
      success: true,
      message: 'Xóa media thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Xóa media thất bại'
    });
  }
};

const uploadImage = async (req, res) => {
  try {
    const data = await mediaUploadService.uploadImage(req.file);
    return res.status(200).json({
      success: true,
      message: 'Upload ảnh thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Upload ảnh thất bại'
    });
  }
};

const uploadMusic = async (req, res) => {
  try {
    const data = await mediaUploadService.uploadMusic(req.file);
    return res.status(200).json({
      success: true,
      message: 'Upload nhạc thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Upload nhạc thất bại'
    });
  }
};

const uploadMusicLocal = async (req, res) => {
  try {
    const data = await mediaUploadService.uploadMusicLocal(
      req.file,
      req.user?.id,
      req.body.invitation_id
    );
    return res.status(200).json({
      success: true,
      message: 'Upload nhạc local thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Upload nhạc local thất bại'
    });
  }
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

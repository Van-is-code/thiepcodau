const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Optional JWT verification - attaches req.user if valid token present, but doesn't block if missing or invalid
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, env.jwtSecret);
      req.user = decoded;
    }
  } catch (error) {
    req.user = null;
  }
  next();
};

// Verify JWT token
const authenticate = (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng cung cấp token'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, env.jwtSecret);
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ'
    });
  }
};

// Check admin role
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin có quyền truy cập'
    });
  }
  next();
};

// Check user role (user or admin)
const userOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'user' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối'
    });
  }
  next();
};

// Chỉ cộng tác viên
const ctvOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'ctv') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ cộng tác viên có quyền truy cập'
    });
  }
  next();
};

// Admin hoặc cộng tác viên
const adminOrCtv = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'ctv')) {
    return res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối'
    });
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  adminOnly,
  userOrAdmin,
  ctvOnly,
  adminOrCtv
};

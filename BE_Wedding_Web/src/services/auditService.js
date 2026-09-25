const { AuditLog } = require('../models');

// Ghi 1 dòng nhật ký. Không bao giờ ném lỗi ra ngoài luồng nghiệp vụ chính
// (audit hỏng không được làm hỏng thanh toán) — trừ khi truyền trong transaction
// thì để lỗi nổi lên để rollback đồng bộ.
const log = async (
  { actorType, actorId = null, action, entityType, entityId = null, oldValue = null, newValue = null, ip = null },
  options = {}
) => {
  const payload = {
    actor_type: actorType,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: oldValue,
    new_value: newValue,
    ip,
    created_at: new Date()
  };

  if (options.transaction) {
    return AuditLog.create(payload, { transaction: options.transaction });
  }

  try {
    return await AuditLog.create(payload);
  } catch (error) {
    console.error('[audit] ghi log thất bại:', error.message);
    return null;
  }
};

// Suy ra actorType từ req.user.role
const actorFromReq = (req) => {
  const role = req.user?.role;
  const actorType = role === 'admin' ? 'admin' : role === 'ctv' ? 'ctv' : 'customer';
  return {
    actorType,
    actorId: req.user?.id || null,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null
  };
};

module.exports = { log, actorFromReq };

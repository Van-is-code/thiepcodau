const express = require('express');
const { authenticate, adminOnly } = require('../middlewares/auth');
const admin = require('../controllers/adminController');
const templateAdmin = require('../controllers/templateAdminController');
const { zipUpload, verifyUpload } = require('../middlewares/uploadGuard');
const ctvAdmin = require('../controllers/adminCtvController');

const router = express.Router();

router.use(authenticate, adminOnly);

router.get('/stats', admin.stats);

// ============ Hệ CTV / thanh toán / hoa hồng / ví ============

// CTV
router.get('/ctvs', ctvAdmin.listCtvs);
router.post('/ctvs', ctvAdmin.createCtv);
router.get('/ctvs/:id', ctvAdmin.getCtv);
router.patch('/ctvs/:id', ctvAdmin.updateCtv);
router.post('/ctvs/:id/lock', ctvAdmin.lockCtv);
router.post('/ctvs/:id/unlock', ctvAdmin.unlockCtv);
router.get('/ctvs/:id/stats', ctvAdmin.getCtvStats);
router.post('/ctvs/:id/payout-requests', ctvAdmin.createPayoutForCtv);

// Giá sàn sản phẩm
router.get('/products', ctvAdmin.listProducts);
router.patch('/products/:id', ctvAdmin.updateProduct);

// Đơn / khách / giao dịch (toàn hệ)
router.get('/ctv-orders', ctvAdmin.listOrders);
router.get('/ctv-customers', ctvAdmin.listCustomers);
router.get('/payment-transactions', ctvAdmin.listPaymentTransactions);
router.post('/ctv-orders/:id/refund', ctvAdmin.refundOrder);

// Đối soát
router.get('/reconciliation', ctvAdmin.reconciliation);

// Phiếu rút
router.get('/payout-requests', ctvAdmin.listPayouts);
router.post('/payout-requests/:id/approve', ctvAdmin.approvePayout);
router.post('/payout-requests/:id/reject', ctvAdmin.rejectPayout);
router.post('/payout/run-auto-sweep', ctvAdmin.runAutoSweep);

// Chính sách rút tiền toàn hệ: mức rút tối thiểu, thứ + giờ quét tự động.
router.get('/payout/policy', ctvAdmin.getPayoutPolicy);
router.patch('/payout/policy', ctvAdmin.updatePayoutPolicy);
router.get('/payout/policy/preview', ctvAdmin.previewPayoutPolicy);

// ----- Thu hộ (collection) & chi hộ (disbursement) -----
// Thu hộ: nền tảng nhận toàn bộ tiền khách trả, giữ lại hoa hồng, phần còn lại là
// thu HỘ cho CTV. Chi hộ: chuyển phần đó về tài khoản ngân hàng CTV qua payOS Payouts.
router.get('/collections/summary', ctvAdmin.collectionSummary);
router.get('/collections/by-ctv', ctvAdmin.collectionByCtv);
router.get('/payouts/balance', ctvAdmin.payoutBalance);
router.post('/payouts/reconcile', ctvAdmin.reconcileDisbursements);

// Nhật ký
router.get('/audit-logs', ctvAdmin.listAuditLogs);

// Tài khoản khách
router.get('/users', admin.listUsers);
router.post('/users', admin.createUser);
router.get('/users/:id', admin.getUserDetail);
router.patch('/users/:id', admin.updateUser);
router.post('/users/:id/slots', admin.addSlots);
router.post('/users/:id/invitations', admin.createUserInvitation);
router.delete('/users/:id', admin.deleteUser);

// Thiệp
router.get('/invitations', admin.listInvitations);
router.get('/invitations/:id', admin.getInvitation);
router.patch('/invitations/:id/unlock', admin.unlockInvitation);
router.patch('/invitations/:id/lock', admin.lockInvitation);
router.patch('/invitations/:id/edit-deadline', admin.setEditDeadline);
router.delete('/invitations/:id', admin.deleteInvitation);

// ----- Mẫu thiệp: nhập theme + quản lý quyền -----
// Xem trước: chạy bộ chuyển đổi nhưng KHÔNG ghi gì, trả báo cáo để admin soát.
const themeZip = zipUpload();
router.post('/templates/preview', themeZip.single('theme'), verifyUpload('zip'), templateAdmin.previewTheme);
// Nhập thật: chuyển đổi + giải nén + tạo bản ghi (vào trạng thái nháp).
// Nhập thật: có preview_token thì dùng lại gói đã dựng, không cần tải lên lại.
router.post('/templates/import', themeZip.single('theme'), verifyUpload('zip', { required: false }), templateAdmin.importTheme);
router.delete('/templates/preview/:token', templateAdmin.discardPreview);

router.get('/templates/manage', templateAdmin.list);
router.get('/templates/manage/:id', templateAdmin.detail);
router.patch('/templates/manage/:id', templateAdmin.update);
// Chỉ xoá được khi chưa có thiệp nào dùng — xem ghi chú trong templateAdminService.
router.delete('/templates/manage/:id', templateAdmin.remove);

// Cấp quyền dùng mẫu cho 1 CTV / 1 khách / 1 tài khoản.
router.post('/templates/manage/:id/grants', templateAdmin.grant);
router.patch('/templates/grants/:permissionId', templateAdmin.toggleGrant);
router.delete('/templates/grants/:permissionId', templateAdmin.revoke);

// Mẫu (route cũ, giữ để không phá giao diện hiện có)
router.get('/templates', admin.listTemplates);
router.patch('/templates/:id', admin.updateTemplate);
router.delete('/templates/:id', admin.deleteTemplate);

module.exports = router;

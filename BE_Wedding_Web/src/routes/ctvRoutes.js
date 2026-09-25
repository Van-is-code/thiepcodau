const express = require('express');
const { authenticate, ctvOnly } = require('../middlewares/auth');
const ctv = require('../controllers/ctvController');

const router = express.Router();

router.use(authenticate, ctvOnly, ctv.loadCtv);

// Hồ sơ & dashboard
router.get('/me', ctv.getMe);
router.get('/dashboard', ctv.getDashboard);
router.patch('/me/payout-settings', ctv.updatePayoutSettings);

// Khách hàng
router.get('/customers', ctv.listCustomers);
router.post('/customers', ctv.createCustomer);
router.get('/customers/:id', ctv.getCustomer);
router.patch('/customers/:id', ctv.updateCustomer);
router.delete('/customers/:id', ctv.deleteCustomer);
router.get('/customers/:id/orders', ctv.getCustomerOrders);
router.get('/customers/:id/cards', ctv.getCustomerCards);
router.post('/customers/:id/invitations', ctv.createCustomerInvitation);

// Quản lý thiệp
router.get('/invitations', ctv.listInvitations);
router.post('/invitations/:id/lock', ctv.lockInvitation);
router.post('/invitations/:id/unlock', ctv.unlockInvitation);

// Đơn hàng
router.post('/orders', ctv.createOrder);
router.get('/orders', ctv.listOrders);
router.get('/orders/:id', ctv.getOrder);
router.get('/orders/:id/payment', ctv.getOrderPayment);
router.post('/orders/:id/cancel', ctv.cancelOrder);

// Ví & rút tiền
router.get('/wallet', ctv.getWallet);
// Sổ thu hộ: nền tảng đã thu hộ bao nhiêu cho CTV này, đã chi lại bao nhiêu.
router.get('/collections', ctv.getCollections);
router.get('/payout-requests', ctv.listPayouts);
router.post('/payout-requests', ctv.createPayout);
router.post('/payout-requests/:id/cancel', ctv.cancelPayout);

module.exports = router;

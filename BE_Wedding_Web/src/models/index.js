const sequelize = require('../config/db');
const User = require('./User');
const InvitationTemplate = require('./InvitationTemplate');
const Invitation = require('./Invitation');
const InvitationImage = require('./InvitationImage');
const PrivateInvitation = require('./PrivateInvitation');
const Guest = require('./Guest');
const MessageCheckin = require('./MessageCheckin');
const Groom = require('./Groom');
const Bride = require('./Bride');
const Order = require('./Order');
const Invoice = require('./Invoice');
const Transaction = require('./Transaction');
const MusicTrack = require('./MusicTrack');

// ----- Hệ CTV / thanh toán / hoa hồng / ví -----
const Product = require('./Product');
const AppSetting = require('./AppSetting');
const CtvProfile = require('./CtvProfile');
const Customer = require('./Customer');
const CardEntitlement = require('./CardEntitlement');
const PaymentTransaction = require('./PaymentTransaction');
const Wallet = require('./Wallet');
const WalletTransaction = require('./WalletTransaction');
const PayoutRequest = require('./PayoutRequest');
const AuditLog = require('./AuditLog');
const CollectionRecord = require('./CollectionRecord');
const TemplatePermission = require('./TemplatePermission');

// users.id -> *.users_id
User.hasMany(Invitation, { foreignKey: 'users_id', as: 'invitations' });
Invitation.belongsTo(User, { foreignKey: 'users_id', as: 'user' });

User.hasMany(Guest, { foreignKey: 'users_id', as: 'guests' });
Guest.belongsTo(User, { foreignKey: 'users_id', as: 'user' });

User.hasMany(InvitationImage, { foreignKey: 'users_id', as: 'invitationImages' });
InvitationImage.belongsTo(User, { foreignKey: 'users_id', as: 'user' });

User.hasMany(Groom, { foreignKey: 'users_id', as: 'grooms' });
Groom.belongsTo(User, { foreignKey: 'users_id', as: 'user' });

User.hasMany(Bride, { foreignKey: 'users_id', as: 'brides' });
Bride.belongsTo(User, { foreignKey: 'users_id', as: 'user' });

// invitation_templates.id -> invitations.template_id
InvitationTemplate.hasMany(Invitation, { foreignKey: 'template_id', as: 'invitations' });
Invitation.belongsTo(InvitationTemplate, { foreignKey: 'template_id', as: 'template' });

// invitations.id -> invitation_images.invitation_id
Invitation.hasMany(InvitationImage, { foreignKey: 'invitation_id', as: 'images' });
InvitationImage.belongsTo(Invitation, { foreignKey: 'invitation_id', as: 'invitation' });

// invitations.id -> private_invitation.invitationns_id
Invitation.hasMany(PrivateInvitation, { foreignKey: 'invitationns_id', as: 'privateInvitations' });
PrivateInvitation.belongsTo(Invitation, { foreignKey: 'invitationns_id', as: 'invitation' });

// guest.id -> private_invitation.guest_id
Guest.hasOne(PrivateInvitation, { foreignKey: 'guest_id', as: 'privateInvitation' });
PrivateInvitation.belongsTo(Guest, { foreignKey: 'guest_id', as: 'guest' });

// invitations.id -> messages_checkins.invitation_id
Invitation.hasMany(MessageCheckin, { foreignKey: 'invitation_id', as: 'messagesCheckins' });
MessageCheckin.belongsTo(Invitation, { foreignKey: 'invitation_id', as: 'invitation' });

// guest.id -> messages_checkins.guest_id
Guest.hasMany(MessageCheckin, { foreignKey: 'guest_id', as: 'messagesCheckins' });
MessageCheckin.belongsTo(Guest, { foreignKey: 'guest_id', as: 'guest' });

// groom.id / bride.id -> invitations.groom_id / invitations.bride_id
Groom.hasMany(Invitation, { foreignKey: 'groom_id', as: 'invitationsAsGroom' });
Invitation.belongsTo(Groom, { foreignKey: 'groom_id', as: 'groom' });

Bride.hasMany(Invitation, { foreignKey: 'bride_id', as: 'invitationsAsBride' });
Invitation.belongsTo(Bride, { foreignKey: 'bride_id', as: 'bride' });

// users.id -> orders.users_id
User.hasMany(Order, { foreignKey: 'users_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'users_id', as: 'user' });

// orders.id -> invoices.order_id
Order.hasOne(Invoice, { foreignKey: 'order_id', as: 'invoice' });
Invoice.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// orders.id -> transactions.order_id (SePay log — giữ nguyên)
Order.hasMany(Transaction, { foreignKey: 'order_id', as: 'transactions' });
Transaction.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// ============ Quan hệ hệ CTV ============

// users.id -> ctv_profiles.user_id (1-1)
User.hasOne(CtvProfile, { foreignKey: 'user_id', as: 'ctvProfile' });
CtvProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// users.id -> customers.user_id (1-1)
User.hasOne(Customer, { foreignKey: 'user_id', as: 'customer' });
Customer.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ctv_profiles.id -> customers.ctv_id (1-N)
CtvProfile.hasMany(Customer, { foreignKey: 'ctv_id', as: 'customers' });
Customer.belongsTo(CtvProfile, { foreignKey: 'ctv_id', as: 'ctv' });

// ctv_profiles.id -> wallets.ctv_id (1-1)
CtvProfile.hasOne(Wallet, { foreignKey: 'ctv_id', as: 'wallet' });
Wallet.belongsTo(CtvProfile, { foreignKey: 'ctv_id', as: 'ctv' });

// ctv_profiles.id -> orders.ctv_id (1-N)
CtvProfile.hasMany(Order, { foreignKey: 'ctv_id', as: 'orders' });
Order.belongsTo(CtvProfile, { foreignKey: 'ctv_id', as: 'ctv' });

// customers.id -> orders.customer_id (1-N)
Customer.hasMany(Order, { foreignKey: 'customer_id', as: 'orders' });
Order.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

// products.id -> orders.product_id (1-N)
Product.hasMany(Order, { foreignKey: 'product_id', as: 'orders' });
Order.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// customers.id -> card_entitlements.customer_id (1-N)
Customer.hasMany(CardEntitlement, { foreignKey: 'customer_id', as: 'entitlements' });
CardEntitlement.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Order.hasMany(CardEntitlement, { foreignKey: 'order_id', as: 'entitlements' });
CardEntitlement.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// orders.id -> payment_transactions.order_id (1-N)
Order.hasMany(PaymentTransaction, { foreignKey: 'order_id', as: 'paymentTransactions' });
PaymentTransaction.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// wallets.id -> wallet_transactions.wallet_id (1-N)
Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
CtvProfile.hasMany(WalletTransaction, { foreignKey: 'ctv_id', as: 'walletTransactions' });
WalletTransaction.belongsTo(CtvProfile, { foreignKey: 'ctv_id', as: 'ctv' });

// ctv_profiles.id -> payout_requests.ctv_id (1-N)
CtvProfile.hasMany(PayoutRequest, { foreignKey: 'ctv_id', as: 'payoutRequests' });
PayoutRequest.belongsTo(CtvProfile, { foreignKey: 'ctv_id', as: 'ctv' });
Wallet.hasMany(PayoutRequest, { foreignKey: 'wallet_id', as: 'payoutRequests' });
PayoutRequest.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });
PayoutRequest.hasMany(WalletTransaction, { foreignKey: 'payout_request_id', as: 'walletTransactions' });
WalletTransaction.belongsTo(PayoutRequest, { foreignKey: 'payout_request_id', as: 'payoutRequest' });

// ----- Phân quyền mẫu thiệp -----
InvitationTemplate.hasMany(TemplatePermission, { foreignKey: 'template_id', as: 'permissions' });
TemplatePermission.belongsTo(InvitationTemplate, { foreignKey: 'template_id', as: 'template' });
Customer.hasMany(InvitationTemplate, { foreignKey: 'owner_customer_id', as: 'exclusiveTemplates' });
InvitationTemplate.belongsTo(Customer, { foreignKey: 'owner_customer_id', as: 'ownerCustomer' });

// ----- Thu hộ: 1 đơn <-> 1 dòng sổ thu hộ -----
Order.hasOne(CollectionRecord, { foreignKey: 'order_id', as: 'collection' });
CollectionRecord.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
CtvProfile.hasMany(CollectionRecord, { foreignKey: 'ctv_id', as: 'collections' });
CollectionRecord.belongsTo(CtvProfile, { foreignKey: 'ctv_id', as: 'ctv' });

module.exports = {
  sequelize,
  User,
  InvitationTemplate,
  Invitation,
  InvitationImage,
  PrivateInvitation,
  Guest,
  MessageCheckin,
  Groom,
  Bride,
  Order,
  Invoice,
  Transaction,
  MusicTrack,
  Product,
  AppSetting,
  CtvProfile,
  Customer,
  CardEntitlement,
  PaymentTransaction,
  Wallet,
  WalletTransaction,
  PayoutRequest,
  AuditLog,
  CollectionRecord,
  TemplatePermission
};

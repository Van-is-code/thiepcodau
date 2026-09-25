const { Order, Invoice, User, Transaction } = require('../models');

const SEPAY_CONFIG = {
  apiUrl: process.env.SEPAY_API_URL || 'https://api.sepay.vn/v2',
  apiKey: process.env.SECRET_KEY || process.env.SEPAY_API_KEY || '',
  partnerCode: process.env.MERCHANT_ID || process.env.SEPAY_PARTNER_CODE || '',
  // Bank account details for QR generation (from .env)
  bankCode: process.env.SEPAY_BANK_CODE || 'MBBank', // E.g., MBBank, VCB, etc.
  accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '0903252427'
};

const isMissingTransactionsTableError = (error) => {
  const message = String(error?.message || '');
  const code = String(error?.original?.code || error?.parent?.code || error?.code || '');
  return code === '42P01' && /transactions/i.test(message);
};

const createTransactionLog = async (payload) => {
  try {
    await Transaction.create(payload);
  } catch (error) {
    // Do not block payment success flow when audit table is missing in production.
    if (isMissingTransactionsTableError(error)) {
      console.warn('[Payment] transactions table is missing. Skip transaction log.');
      return;
    }
    throw error;
  }
};

const generateQRCode = async (order) => {
  try {
    // Format theo tài liệu SePay:
    // https://qr.sepay.vn/img?acc=SO_TAI_KHOAN&bank=NGAN_HANG&amount=SO_TIEN&des=NOI_DUNG&template=TEMPLATE&download=DOWNLOAD
    // Nội dung chuyển khoản tiêu chuẩn: chỉ mã đơn hàng
    const orderCode = order.transfer_content || `DH${order.id}`;
    const transferContent = orderCode;
    const params = new URLSearchParams({
      acc: String(SEPAY_CONFIG.accountNumber),
      bank: String(SEPAY_CONFIG.bankCode),
      amount: String(Math.floor(Number(order.amount))),
      des: String(transferContent),
      template: 'compact',
      download: 'false'
    });
    const qrCodeUrl = `https://qr.sepay.vn/img?${params.toString()}`;

    return {
      qrUrl: qrCodeUrl,
      orderCode,
      amount: order.amount,
      transferContent,
      bankCode: SEPAY_CONFIG.bankCode,
      accountNumber: SEPAY_CONFIG.accountNumber
    };
  } catch (error) {
    const err = new Error('Lỗi tạo mã QR thanh toán');
    err.status = 500;
    throw err;
  }
};

const requestPayment = async (userId, slotQuantity = 1, amount = null) => {
  try {
    // Kiểm tra user tồn tại
    const user = await User.findByPk(userId);
    if (!user) {
      const error = new Error('Không tìm thấy người dùng');
      error.status = 404;
      throw error;
    }

    const normalizedSlotQuantity = Number.parseInt(slotQuantity, 10);
    const normalizedAmount = Number.parseInt(amount, 10);

    if (!Number.isInteger(normalizedSlotQuantity) || normalizedSlotQuantity <= 0) {
      const error = new Error('slotQuantity phải là số nguyên dương');
      error.status = 400;
      throw error;
    }

    if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0) {
      const error = new Error('amount phải là số nguyên dương (VND)');
      error.status = 400;
      throw error;
    }

    const totalAmount = normalizedAmount;

    // Tạo đơn hàng
    const order = await Order.create({
      users_id: userId,
      amount: totalAmount,
      slot_quantity: normalizedSlotQuantity,
      status: 'pending',
      transfer_content: '', // Will be set after order creation with DH prefix
      created_at: new Date(),
      updated_at: new Date()
    });

    // Update transfer_content with order ID in default format DH{order_id}
    const orderCode = `DH${order.id}`;
    order.transfer_content = orderCode;
    await order.save();

    // Tạo QR code
    const qrData = await generateQRCode(order);

    return {
      order: {
        id: order.id,
        amount: order.amount,
        slotQuantity: order.slot_quantity,
        status: order.status,
        transferContent: order.transfer_content
      },
      qrCode: qrData
    };
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Lỗi tạo đơn thanh toán');
    err.status = 500;
    err.originalError = error;
    throw err;
  }
};

const handleWebhook = async (webhookData) => {
  try {
    if (!webhookData || typeof webhookData !== 'object') {
      return {
        success: false,
        message: 'Webhook payload không hợp lệ'
      };
    }

    // Webhook data structure from Sepay:
    // {
    //   id: sepay_transaction_id,
    //   gateway: bank_name,
    //   transactionDate: transaction_time,
    //   accountNumber: bank_account,
    //   code: optional_code,
    //   content: transfer_content (nội dung chuyển khoản),
    //   transferType: 'in' or 'out',
    //   transferAmount: amount,
    //   accumulated: balance,
    //   subAccount: sub_account,
    //   referenceCode: reference_code,
    //   description: full_description
    // }

    const {
      id: transactionId,
      gateway,
      transactionDate,
      accountNumber,
      code,
      content: transferContent,
      transferType,
      transferAmount,
      accumulated,
      subAccount,
      referenceCode,
      description
    } = webhookData;

    const normalizedTransferType = String(transferType || '').toLowerCase();
    const normalizedTransferContent = String(transferContent || '');
    const normalizedAmount = Number.parseInt(transferAmount, 10);
    const normalizedAccumulated = Number.parseInt(accumulated, 10);

    // Chỉ xử lý giao dịch tiền vào (in)
    if (normalizedTransferType !== 'in') {
      return {
        success: true,
        message: 'Chỉ xử lý giao dịch tiền vào'
      };
    }

    if (!transactionId) {
      return {
        success: false,
        message: 'Thiếu transaction id từ SePay'
      };
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return {
        success: false,
        message: 'Số tiền giao dịch không hợp lệ'
      };
    }

    // Kiểm tra transaction có xảy ra trùng lặp không (chống webhook retry)
    // Bằng cách kiểm tra nếu transaction ID đã được lưu trong hệ thống
    let existingTransaction = null;
    try {
      existingTransaction = await Transaction.findOne({
        where: { transaction_id: transactionId }
      });
    } catch (error) {
      if (isMissingTransactionsTableError(error)) {
        console.warn('[Payment] transactions table is missing. Continue without duplicate transaction check.');
      } else {
        throw error;
      }
    }

    if (existingTransaction) {
      return {
        success: true,
        message: 'Giao dịch đã được xử lý trước đó'
      };
    }

    // Trích xuất Order ID từ nội dung chuyển khoản bằng regex
    // Mã đơn hàng có format: DH{order_id}, vd: DH550e8400e29b41d4a716446655440000
    const orderIdRegex = /DH([\w-]+)/i;
    const match = normalizedTransferContent.match(orderIdRegex);

    if (!match || !match[1]) {
      // Lưu transaction nhưng không thể tìm đơn hàng
      await createTransactionLog({
        transaction_id: transactionId,
        gateway,
        transaction_date: transactionDate,
        account_number: accountNumber,
        sub_account: subAccount,
        amount_in: Math.floor(normalizedAmount),
        amount_out: 0,
        accumulated: Number.isFinite(normalizedAccumulated) ? Math.floor(normalizedAccumulated) : 0,
        code,
        transaction_content: normalizedTransferContent,
        reference_number: referenceCode,
        body: description,
        order_id: null,
        status: 'unmatched',
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: false,
        message: 'Không tìm thấy mã đơn hàng trong nội dung chuyển khoản'
      };
    }

    const orderId = match[1];

    // Tìm đơn hàng
    const order = await Order.findOne({
      where: { id: orderId },
      include: [{ model: User, as: 'user' }]
    });

    if (!order) {
      // Lưu transaction nhưng không tìm thấy đơn hàng
      await createTransactionLog({
        transaction_id: transactionId,
        gateway,
        transaction_date: transactionDate,
        account_number: accountNumber,
        sub_account: subAccount,
        amount_in: Math.floor(normalizedAmount),
        amount_out: 0,
        accumulated: Number.isFinite(normalizedAccumulated) ? Math.floor(normalizedAccumulated) : 0,
        code,
        transaction_content: normalizedTransferContent,
        reference_number: referenceCode,
        body: description,
        order_id: orderId,
        status: 'order_not_found',
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: false,
        message: `Không tìm thấy đơn hàng với ID: ${orderId}`
      };
    }

    // Kiểm tra số tiền khớp
    if (Math.floor(normalizedAmount) !== Math.floor(Number(order.amount))) {
      await createTransactionLog({
        transaction_id: transactionId,
        gateway,
        transaction_date: transactionDate,
        account_number: accountNumber,
        sub_account: subAccount,
        amount_in: Math.floor(normalizedAmount),
        amount_out: 0,
        accumulated: Number.isFinite(normalizedAccumulated) ? Math.floor(normalizedAccumulated) : 0,
        code,
        transaction_content: normalizedTransferContent,
        reference_number: referenceCode,
        body: description,
        order_id: orderId,
        status: 'amount_mismatch',
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: false,
        message: `Số tiền không khớp. Yêu cầu: ${order.amount}, Nhận: ${normalizedAmount}`
      };
    }

    // Chỉ chấp nhận đơn ở trạng thái chờ thanh toán
    if (order.status !== 'pending') {
      await createTransactionLog({
        transaction_id: transactionId,
        gateway,
        transaction_date: transactionDate,
        account_number: accountNumber,
        sub_account: subAccount,
        amount_in: Math.floor(normalizedAmount),
        amount_out: 0,
        accumulated: Number.isFinite(normalizedAccumulated) ? Math.floor(normalizedAccumulated) : 0,
        code,
        transaction_content: normalizedTransferContent,
        reference_number: referenceCode,
        body: description,
        order_id: orderId,
        status: 'duplicate_order',
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: true,
        message: `Đơn hàng đang ở trạng thái ${order.status}, bỏ qua cập nhật` 
      };
    }

    // Kiểm tra nếu đơn hàng đã được thanh toán rồi
    if (order.status === 'paid') {
      // Vẫn lưu transaction nhưng trả về success để không retry webhook
      await createTransactionLog({
        transaction_id: transactionId,
        gateway,
        transaction_date: transactionDate,
        account_number: accountNumber,
        sub_account: subAccount,
        amount_in: Math.floor(normalizedAmount),
        amount_out: 0,
        accumulated: Number.isFinite(normalizedAccumulated) ? Math.floor(normalizedAccumulated) : 0,
        code,
        transaction_content: normalizedTransferContent,
        reference_number: referenceCode,
        body: description,
        order_id: orderId,
        status: 'duplicate_order',
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: true,
        message: 'Đơn hàng đã được ghi nhận thanh toán trước đó'
      };
    }

    // Cập nhật trạng thái đơn hàng thành paid
    order.status = 'paid';
    order.transaction_id = transactionId;
    order.updated_at = new Date();
    await order.save();

    // Lưu transaction với status success
    await createTransactionLog({
      transaction_id: transactionId,
      gateway,
      transaction_date: transactionDate,
      account_number: accountNumber,
      sub_account: subAccount,
      amount_in: Math.floor(transferAmount),
      amount_out: 0,
      accumulated: Math.floor(accumulated),
      code,
      transaction_content: transferContent,
      reference_number: referenceCode,
      body: description,
      order_id: orderId,
      status: 'success',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Tạo invoice
    await Invoice.create({
      order_id: order.id,
      transaction_id: transactionId,
      transfer_content: normalizedTransferContent,
      payment_method: 'sepay',
      paid_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });

    // Cộng slot cho user
    const user = order.user;
    await user.increment('slot', { by: order.slot_quantity });

    return {
      success: true,
      message: 'Thanh toán thành công',
      order: {
        id: order.id,
        status: order.status,
        slotAdded: order.slot_quantity
      }
    };
  } catch (error) {
    console.error('Error in handleWebhook:', error);
    // Trả về success để Sepay không retry, nhưng lưu error log
    return {
      success: false,
      message: error.message || 'Lỗi xử lý webhook thanh toán',
      error: error.originalError || error
    };
  }
};

const getOrderDetails = async (orderId, userId = null) => {
  try {
    const findOptions = { where: { id: orderId } };

    // Nếu có userId, chỉ cho phép xem order của chính mình (trừ admin)
    if (userId) {
      findOptions.where.users_id = userId;
    }

    const order = await Order.findOne({
      ...findOptions,
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'slot'] },
        { model: Invoice, as: 'invoice' }
      ]
    });

    if (!order) {
      const error = new Error('Không tìm thấy đơn hàng');
      error.status = 404;
      throw error;
    }

    return order;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Lỗi lấy thông tin đơn hàng');
    err.status = 500;
    throw err;
  }
};

const getUserOrders = async (userId, page = 1, limit = 20) => {
  try {
    const offset = (page - 1) * limit;

    const { count, rows } = await Order.findAndCountAll({
      where: { users_id: userId },
      include: [{ model: Invoice, as: 'invoice' }],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    return {
      items: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    };
  } catch (error) {
    const err = new Error('Lỗi lấy danh sách đơn hàng');
    err.status = 500;
    throw err;
  }
};

const cancelOrder = async (orderId, userId) => {
  try {
    const order = await Order.findOne({
      where: { id: orderId, users_id: userId }
    });

    if (!order) {
      const error = new Error('Không tìm thấy đơn hàng');
      error.status = 404;
      throw error;
    }

    if (order.status !== 'pending') {
      const error = new Error('Chỉ có thể hủy đơn hàng ở trạng thái chờ thanh toán');
      error.status = 400;
      throw error;
    }

    order.status = 'cancelled';
    order.updated_at = new Date();
    await order.save();

    return order;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Lỗi hủy đơn hàng');
    err.status = 500;
    throw err;
  }
};

/**
 * Kiểm tra trạng thái thanh toán của đơn hàng
 * Dùng cho AJAX endpoint từ frontend (checkout page)
 * Frontend sẽ định kỳ poll endpoint này để kiểm tra xem thanh toán có thành công chưa
 */
const checkPaymentStatus = async (orderId, userId = null) => {
  try {
    // userId là BẮT BUỘC: thiếu nó thì truy vấn không có ràng buộc chủ sở hữu và
    // endpoint trở thành công cụ dò trạng thái mọi đơn hàng trong hệ thống.
    if (!userId) {
      const e = new Error('Yêu cầu đăng nhập'); e.status = 401; throw e;
    }
    const findOptions = { where: { id: orderId, users_id: userId } };

    const order = await Order.findOne(findOptions);

    if (!order) {
      return {
        payment_status: 'order_not_found',
        message: 'Không tìm thấy đơn hàng'
      };
    }

    return {
      payment_status: order.status,
      // Convert status to match Sepay format if needed
      // pending -> Unpaid, paid -> Paid, cancelled -> Cancelled
      message: order.status
    };
  } catch (error) {
    console.error('Error checking payment status:', error);
    return {
      payment_status: 'error',
      message: 'Lỗi kiểm tra trạng thái thanh toán'
    };
  }
};

module.exports = {
  requestPayment,
  handleWebhook,
  getOrderDetails,
  getUserOrders,
  cancelOrder,
  checkPaymentStatus
};

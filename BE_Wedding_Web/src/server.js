const app = require('./app');
const { testConnection } = require('./config/db');
const autoPayoutJob = require('./jobs/autoPayoutJob');
const notifyService = require('./services/notifyService');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Test database connection
testConnection();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`🧩 CRUD base endpoint: http://localhost:${PORT}/api`);

  // Giám sát (kiểm bất biến ví) + rút tiền tự động theo lịch tuần.
  autoPayoutJob.start();

  notifyService.info('Backend khởi động', `port ${PORT} · môi trường ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err && err.name, err && err.message);
  try {
    notifyService.alert('UNHANDLED REJECTION — backend đang tắt', String((err && err.stack) || err).slice(0, 800));
  } catch (_e) { /* ignore */ }
  setTimeout(() => process.exit(1), 1500);
});

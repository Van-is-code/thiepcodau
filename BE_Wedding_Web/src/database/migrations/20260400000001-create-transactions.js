// Migration file for creating transactions table
// This should be named with a timestamp: 20260000000000-create-transactions.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      transaction_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Transaction ID from SePay'
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Order ID if found from transfer content'
      },
      gateway: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Bank name (gateway)'
      },
      transaction_date: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Transaction time'
      },
      account_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Bank account number'
      },
      sub_account: {
        type: Sequelize.STRING(250),
        allowNull: true,
        comment: 'Sub account'
      },
      amount_in: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Amount in'
      },
      amount_out: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Amount out'
      },
      accumulated: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Accumulated balance'
      },
      code: {
        type: Sequelize.STRING(250),
        allowNull: true,
        comment: 'Payment code'
      },
      transaction_content: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Transfer content'
      },
      reference_number: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Reference code'
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Full description from bank'
      },
      status: {
        type: Sequelize.ENUM('success', 'unmatched', 'order_not_found', 'amount_mismatch', 'duplicate_order'),
        allowNull: false,
        defaultValue: 'unmatched',
        comment: 'Transaction processing status'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW
      }
    });

    // Add index for transaction_id for quick lookup
    await queryInterface.addIndex('transactions', ['transaction_id']);
    
    // Add index for order_id for quick lookup
    await queryInterface.addIndex('transactions', ['order_id']);
    
    // Add index for created_at for sorting and filtering
    await queryInterface.addIndex('transactions', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('transactions');
  }
};

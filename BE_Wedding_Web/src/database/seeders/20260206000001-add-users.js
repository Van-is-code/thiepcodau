'use strict';

const bcrypt = require('bcryptjs');

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Hash passwords
      const adminPassword = await hashPassword('admin123');
      const userPassword = await hashPassword('02092005');

      const now = new Date();

      await queryInterface.bulkInsert('users', [
        {
          id: '11111111-1111-1111-1111-111111111111',
          username: 'admin',
          password: adminPassword,
          role: 'admin',
          slot: 999,
          created_at: now,
          updated_at: now
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          username: 'user',
          password: userPassword,
          role: 'user',
          slot: 5,
          created_at: now,
          updated_at: now
        }
      ], {});

      console.log('✓ Users seeded successfully');
    } catch (error) {
      console.error('Error seeding users:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.bulkDelete('users', {
        username: {
          [Sequelize.Op.in]: ['admin', 'user']
        }
      }, {});

      console.log('✓ Users unseeded successfully');
    } catch (error) {
      console.error('Error unseeding users:', error);
      throw error;
    }
  }
};

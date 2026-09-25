const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Bride = sequelize.define('Bride', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  users_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  name_bride: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  father_bride: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  mother_bride: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  province: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  district: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  commune: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  bank_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  bank_account_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  bank_account_number: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  updated_at: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'bride',
  timestamps: false
});

module.exports = Bride;

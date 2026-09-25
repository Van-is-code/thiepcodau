const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PrivateInvitation = sequelize.define('PrivateInvitation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  guest_id: {
    type: DataTypes.UUID,
    allowNull: true,
    unique: true,
    references: {
      model: 'guest',
      key: 'id'
    }
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  invitationns_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'invitations',
      key: 'id'
    }
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'private_invitation',
  timestamps: false
});

module.exports = PrivateInvitation;

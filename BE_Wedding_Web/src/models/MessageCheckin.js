const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MessageCheckin = sequelize.define('MessageCheckin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  invitation_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'invitations',
      key: 'id'
    }
  },
  guest_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'guest',
      key: 'id'
    }
  },
  name_guest: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  messages: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  confirm_attendance: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  number_of_attendees: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  guests_type: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'messages_checkins',
  timestamps: false
});

module.exports = MessageCheckin;

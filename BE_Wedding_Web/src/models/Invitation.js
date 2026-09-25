const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Invitation = sequelize.define('Invitation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  users_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  template_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'invitation_templates',
      key: 'id'
    }
  },
  invitation_slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  title_vi: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  title_en: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  groom_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'groom',
      key: 'id'
    }
  },
  bride_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'bride',
      key: 'id'
    }
  },
  ceremony_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  ceremony_lunar_text: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  reception_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  reception_lunar_text: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  venue_address: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  map_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  reception_venue_address: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  reception_map_url: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  thank_you_message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  extra_notes: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  music_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: ''
  },
  extra_data: {
    // Dữ liệu riêng theo từng mẫu thiệp (không phổ quát cho mọi template),
    // vd: { accent_color: '#c8856a', hashtag: '#MinhAnhThuHa2026' }
    type: DataTypes.JSONB,
    allowNull: true
  },
  // Số lần bấm "Lưu" trong trình sửa. Hết hạn mức -> khoá sửa.
  edit_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Hạn cuối được sửa = ngày cưới GỐC + 3 ngày. Set 1 lần, không đổi khi sửa lại ngày.
  edit_deadline: {
    type: DataTypes.DATE,
    allowNull: true
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
  tableName: 'invitations',
  timestamps: false
});

module.exports = Invitation;

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('invitation_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      template_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      template_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      html_path: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.createTable('guest', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      users_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      name: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.createTable('groom', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      users_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      name_groom: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      father_grom: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      mother_groom: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      province: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      district: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      commune: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bank_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bank_account_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bank_account_number: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      create_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    await queryInterface.createTable('bride', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      users_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      name_bride: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      father_bride: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      mother_bride: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      province: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      district: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      commune: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bank_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bank_account_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bank_account_number: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.STRING(255),
        allowNull: true
      }
    });

    await queryInterface.createTable('invitations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      users_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'invitation_templates',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      invitation_slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      title_vi: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      title_en: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      groom_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'groom',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      bride_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'bride',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      ceremony_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      ceremony_lunar_text: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      reception_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      reception_lunar_text: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      venue_address: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      map_url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      reception_venue_address: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      reception_map_url: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      thank_you_message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      extra_notes: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      music_url: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.createTable('invitation_images', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      users_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      invitation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'invitations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      image_url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      image_alt: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      image_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'gallery'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      is_cover: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.createTable('private_invitation', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      guest_id: {
        type: Sequelize.UUID,
        allowNull: true,
        unique: true,
        references: {
          model: 'guest',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      url: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      invitationns_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'invitations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('private_invitation', ['guest_id'], {
      name: 'idx_invitation_guest_id'
    });

    await queryInterface.addIndex('private_invitation', ['url'], {
      name: 'idx_private_invitation_url',
      unique: true
    });

    await queryInterface.createTable('messages_checkins', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      invitation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'invitations',
          key: 'id'
        },
        onUpdate: 'NO ACTION',
        onDelete: 'NO ACTION'
      },
      guest_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'guest',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      name_guest: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      messages: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      confirm_attendance: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      number_of_attendees: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      guests_type: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('messages_checkins', ['guest_id'], {
      name: 'idx_messages_guest_id'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('messages_checkins');
    await queryInterface.dropTable('private_invitation');
    await queryInterface.dropTable('invitation_images');
    await queryInterface.dropTable('invitations');
    await queryInterface.dropTable('bride');
    await queryInterface.dropTable('groom');
    await queryInterface.dropTable('guest');
    await queryInterface.dropTable('invitation_templates');
  }
};

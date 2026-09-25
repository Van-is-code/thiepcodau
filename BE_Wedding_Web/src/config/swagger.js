const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Wedding Web API',
      version: '1.0.0',
      description: 'API documentation for Wedding Web backend'
    },
    servers: [
      {
        url: process.env.SWAGGER_SERVER_URL || 'http://localhost:3000',
        description: 'Local server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        UserRegisterInput: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'user_test_01' },
            password: { type: 'string', example: '123456' },
            role: { type: 'string', example: 'user' }
          }
        },
        UserLoginInput: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'user_test_01' },
            password: { type: 'string', example: '123456' }
          }
        },
        UserProfileUpdateInput: {
          type: 'object',
          properties: {
            username: { type: 'string', example: 'user_test_01_updated' },
            role: { type: 'string', example: 'user' }
          }
        },
        ChangePasswordInput: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', example: '123456' },
            newPassword: { type: 'string', example: '12345678' }
          }
        },
        InvitationTemplateInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '22222222-2222-2222-2222-222222222222' },
            template_code: { type: 'string', example: 'temp_code_001' },
            template_name: { type: 'string', example: 'Template 001' },
            html_path: { type: 'string', example: 'templates/template-001/index.html' }
          }
        },
        GroomInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '88888888-8888-8888-8888-888888888888' },
            users_id: { type: 'string', format: 'uuid', example: '11111111-1111-1111-1111-111111111111' },
            name_groom: { type: 'string', example: 'Chu re A' },
            father_grom: { type: 'string', example: 'Ong A' },
            mother_groom: { type: 'string', example: 'Ba A' },
            province: { type: 'string', example: 'HCM' },
            district: { type: 'string', example: 'Q1' },
            commune: { type: 'string', example: 'P Ben Nghe' },
            address: { type: 'string', example: '12 Le Loi' },
            bank_name: { type: 'string', example: 'VCB' },
            bank_account_name: { type: 'string', example: 'CHU RE A' },
            bank_account_number: { type: 'string', example: '123456789' }
          }
        },
        BrideInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '99999999-9999-9999-9999-999999999999' },
            users_id: { type: 'string', format: 'uuid', example: '11111111-1111-1111-1111-111111111111' },
            name_bride: { type: 'string', example: 'Co dau A' },
            father_bride: { type: 'string', example: 'Ong B' },
            mother_bride: { type: 'string', example: 'Ba B' },
            province: { type: 'string', example: 'HCM' },
            district: { type: 'string', example: 'Q7' },
            commune: { type: 'string', example: 'P Tan Phu' },
            address: { type: 'string', example: '45 Nguyen Van Linh' },
            bank_name: { type: 'string', example: 'MB' },
            bank_account_name: { type: 'string', example: 'CO DAU A' },
            bank_account_number: { type: 'string', example: '987654321' }
          }
        },
        InvitationInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '33333333-3333-3333-3333-333333333333' },
            users_id: { type: 'string', format: 'uuid', example: '11111111-1111-1111-1111-111111111111' },
            template_id: { type: 'string', format: 'uuid', example: '22222222-2222-2222-2222-222222222222' },
            invitation_slug: { type: 'string', example: 'thiep-cuoi-001' },
            title_vi: { type: 'string', example: 'Thiep cuoi' },
            title_en: { type: 'string', example: 'Wedding Invitation' },
            groom_id: { type: 'string', format: 'uuid', example: '88888888-8888-8888-8888-888888888888' },
            bride_id: { type: 'string', format: 'uuid', example: '99999999-9999-9999-9999-999999999999' },
            ceremony_date: { type: 'string', format: 'date-time', example: '2026-12-20T08:00:00.000Z' },
            reception_date: { type: 'string', format: 'date', example: '2026-12-20' },
            venue_address: { type: 'string', example: '123 ABC' },
            map_url: { type: 'string', example: 'https://maps.app' },
            reception_venue_address: { type: 'string', example: '456 XYZ' },
            reception_map_url: { type: 'string', example: 'https://maps.app' },
            thank_you_message: { type: 'string', example: 'Cam on ban' },
            extra_notes: { type: 'string', example: 'Dress code: Formal' },
            music_url: { type: 'string', example: 'https://example.com/song.mp3' }
          }
        },
        GuestInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '66666666-6666-6666-6666-666666666666' },
            users_id: { type: 'string', format: 'uuid', example: '11111111-1111-1111-1111-111111111111' },
            invitation_id: { type: 'string', format: 'uuid', example: '33333333-3333-3333-3333-333333333333' },
            name: { type: 'string', example: 'Khach moi A' },
            description: { type: 'string', example: 'Ban than' }
          }
        },
        MessageCheckinInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '77777777-7777-7777-7777-777777777777' },
            invitation_id: { type: 'string', format: 'uuid', example: '33333333-3333-3333-3333-333333333333' },
            guest_id: { type: 'string', format: 'uuid', example: '66666666-6666-6666-6666-666666666666' },
            name_guest: { type: 'string', example: 'Khach moi A' },
            messages: { type: 'string', example: 'Chuc mung' },
            confirm_attendance: { type: 'string', example: 'yes' },
            number_of_attendees: { type: 'integer', example: 2 },
            guests_type: { type: 'string', example: 'friend' }
          }
        },
        InvitationImageInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '44444444-4444-4444-4444-444444444444' },
            users_id: { type: 'string', format: 'uuid', example: '11111111-1111-1111-1111-111111111111' },
            invitation_id: { type: 'string', format: 'uuid', example: '33333333-3333-3333-3333-333333333333' },
            image_url: { type: 'string', example: 'https://example.com/photo.jpg' },
            image_alt: { type: 'string', example: 'Anh cuoi' },
            image_type: { type: 'string', example: 'gallery' },
            sort_order: { type: 'integer', example: 1 },
            is_cover: { type: 'boolean', example: true }
          }
        },
        PrivateInvitationInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '55555555-5555-5555-5555-555555555555' },
            guest_id: { type: 'string', format: 'uuid', example: '66666666-6666-6666-6666-666666666666' },
            invitationns_id: { type: 'string', format: 'uuid', example: '33333333-3333-3333-3333-333333333333' },
            url: { type: 'string', example: 'https://wedding.example.com/private/1' }
          }
        }
      }
    },
    tags: [
      { name: 'Users' },
      { name: 'Invitations' },
      { name: 'Invitation Templates' },
      { name: 'Guests' },
      { name: 'Messages Checkins' },
      { name: 'Invitation Images' },
      { name: 'Media Upload' }
    ],
    paths: {
      '/api/users/register': {
        post: {
          tags: ['Users'],
          summary: 'Register new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserRegisterInput' }
              }
            }
          },
          responses: {
            201: { description: 'Register success' },
            409: { description: 'Username existed' }
          }
        }
      },
      '/api/users/login': {
        post: {
          tags: ['Users'],
          summary: 'Login user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserLoginInput' }
              }
            }
          },
          responses: {
            200: { description: 'Login success and return token' },
            401: { description: 'Invalid username/password' }
          }
        }
      },
      '/api/users/profile': {
        get: {
          tags: ['Users'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Profile info' }
          }
        },
        patch: {
          tags: ['Users'],
          summary: 'Update current user profile',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserProfileUpdateInput' }
              }
            }
          },
          responses: {
            200: { description: 'Update profile success' }
          }
        }
      },
      '/api/users/change-password': {
        post: {
          tags: ['Users'],
          summary: 'Change current user password',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChangePasswordInput' }
              }
            }
          },
          responses: {
            200: { description: 'Change password success' }
          }
        }
      },
      '/api/invitations': {
        get: {
          tags: ['Invitations'],
          summary: 'Get invitations list',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Invitations list' }
          }
        },
        post: {
          tags: ['Invitations'],
          summary: 'Create invitation',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InvitationInput' }
              }
            }
          },
          responses: {
            201: { description: 'Create invitation success' }
          }
        }
      },
      '/api/invitations/{id}': {
        get: {
          tags: ['Invitations'],
          summary: 'Get invitation by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: {
            200: { description: 'Invitation detail' }
          }
        },
        put: {
          tags: ['Invitations'],
          summary: 'Update invitation',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InvitationInput' }
              }
            }
          },
          responses: {
            200: { description: 'Update invitation success' }
          }
        },
        delete: {
          tags: ['Invitations'],
          summary: 'Delete invitation',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: {
            200: { description: 'Delete invitation success' }
          }
        }
      },
      '/api/invitation-templates': {
        get: {
          tags: ['Invitation Templates'],
          summary: 'Get invitation templates list',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Templates list' }
          }
        },
        post: {
          tags: ['Invitation Templates'],
          summary: 'Create invitation template',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InvitationTemplateInput' }
              }
            }
          },
          responses: {
            201: { description: 'Create template success' }
          }
        }
      },
      '/api/invitation-templates/{id}': {
        get: {
          tags: ['Invitation Templates'],
          summary: 'Get invitation template by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Template detail' } }
        },
        put: {
          tags: ['Invitation Templates'],
          summary: 'Update invitation template',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InvitationTemplateInput' }
              }
            }
          },
          responses: { 200: { description: 'Update template success' } }
        },
        delete: {
          tags: ['Invitation Templates'],
          summary: 'Delete invitation template',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Delete template success' } }
        }
      },
      '/api/guests': {
        get: {
          tags: ['Guests'],
          summary: 'Get guests list',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Guests list' } }
        },
        post: {
          tags: ['Guests'],
          summary: 'Create guest and auto-create private invitation',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuestInput' }
              }
            }
          },
          responses: { 201: { description: 'Create guest success' } }
        }
      },
      '/api/guests/{id}': {
        get: {
          tags: ['Guests'],
          summary: 'Get guest by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Guest detail' } }
        },
        put: {
          tags: ['Guests'],
          summary: 'Update guest',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuestInput' }
              }
            }
          },
          responses: { 200: { description: 'Update guest success' } }
        },
        delete: {
          tags: ['Guests'],
          summary: 'Delete guest',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Delete guest success' } }
        }
      },
      '/api/messages-checkins': {
        get: {
          tags: ['Messages Checkins'],
          summary: 'Get messages checkins list (public)',
          responses: { 200: { description: 'Messages checkins list' } }
        },
        post: {
          tags: ['Messages Checkins'],
          summary: 'Create message checkin (public)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MessageCheckinInput' }
              }
            }
          },
          responses: { 201: { description: 'Create message checkin success' } }
        }
      },
      '/api/messages-checkins/{id}': {
        get: {
          tags: ['Messages Checkins'],
          summary: 'Get message checkin by id',
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Message checkin detail' } }
        },
        put: {
          tags: ['Messages Checkins'],
          summary: 'Update message checkin',
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MessageCheckinInput' }
              }
            }
          },
          responses: { 200: { description: 'Update message checkin success' } }
        },
        delete: {
          tags: ['Messages Checkins'],
          summary: 'Delete message checkin',
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Delete message checkin success' } }
        }
      },
      '/api/messages-checkins/invitation/{invitation_id}': {
        get: {
          tags: ['Messages Checkins'],
          summary: 'Get messages checkins by invitation id',
          parameters: [
            {
              in: 'path',
              name: 'invitation_id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Messages by invitation id' } }
        }
      },
      '/api/invitation-images': {
        get: {
          tags: ['Invitation Images'],
          summary: 'Get invitation images list',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Invitation images list' } }
        },
        post: {
          tags: ['Invitation Images'],
          summary: 'Upload invitation image',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InvitationImageInput' }
              }
            }
          },
          responses: { 201: { description: 'Create invitation image success' } }
        }
      },
      '/api/invitation-images/{id}': {
        get: {
          tags: ['Invitation Images'],
          summary: 'Get invitation image by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Invitation image detail' } }
        },
        put: {
          tags: ['Invitation Images'],
          summary: 'Update invitation image',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InvitationImageInput' }
              }
            }
          },
          responses: { 200: { description: 'Update invitation image success' } }
        },
        delete: {
          tags: ['Invitation Images'],
          summary: 'Delete invitation image',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Delete invitation image success' } }
        }
      },
      '/api/private-invitations': {
        get: {
          tags: ['Invitations'],
          summary: 'Get private invitations list',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Private invitations list' } }
        },
        post: {
          tags: ['Invitations'],
          summary: 'Create private invitation',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PrivateInvitationInput' }
              }
            }
          },
          responses: { 201: { description: 'Create private invitation success' } }
        }
      },
      '/api/private-invitations/{id}': {
        get: {
          tags: ['Invitations'],
          summary: 'Get private invitation by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Private invitation detail' } }
        },
        put: {
          tags: ['Invitations'],
          summary: 'Update private invitation',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PrivateInvitationInput' }
              }
            }
          },
          responses: { 200: { description: 'Update private invitation success' } }
        },
        delete: {
          tags: ['Invitations'],
          summary: 'Delete private invitation',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Delete private invitation success' } }
        }
      },
      '/api/grooms': {
        get: {
          tags: ['Invitations'],
          summary: 'Get grooms list',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Grooms list' } }
        },
        post: {
          tags: ['Invitations'],
          summary: 'Create groom',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GroomInput' }
              }
            }
          },
          responses: { 201: { description: 'Create groom success' } }
        }
      },
      '/api/grooms/{id}': {
        get: {
          tags: ['Invitations'],
          summary: 'Get groom by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Groom detail' }
          }
        },
        put: {
          tags: ['Invitations'],
          summary: 'Update groom',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GroomInput' }
              }
            }
          },
          responses: { 200: { description: 'Update groom success' } }
        },
        delete: {
          tags: ['Invitations'],
          summary: 'Delete groom',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Delete groom success' } }
        }
      },
      '/api/brides': {
        get: {
          tags: ['Invitations'],
          summary: 'Get brides list',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Brides list' } }
        },
        post: {
          tags: ['Invitations'],
          summary: 'Create bride',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BrideInput' }
              }
            }
          },
          responses: { 201: { description: 'Create bride success' } }
        }
      },
      '/api/brides/{id}': {
        get: {
          tags: ['Invitations'],
          summary: 'Get bride by id',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Bride detail' } }
        },
        put: {
          tags: ['Invitations'],
          summary: 'Update bride',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BrideInput' }
              }
            }
          },
          responses: { 200: { description: 'Update bride success' } }
        },
        delete: {
          tags: ['Invitations'],
          summary: 'Delete bride',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: { 200: { description: 'Delete bride success' } }
        }
      },
      '/api/media-upload/music/local': {
        post: {
          tags: ['Media Upload'],
          summary: 'Upload local music and update invitation music_url',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary'
                    },
                    invitationId: {
                      type: 'string',
                      format: 'uuid',
                      example: '33333333-3333-3333-3333-333333333333'
                    }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'Upload music success' } }
        }
      },
      '/api/media-upload': {
        post: {
          tags: ['Media Upload'],
          summary: 'Create media asset (Cloudinary)',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    resourceType: { type: 'string', example: 'image' },
                    folder: { type: 'string', example: 'wedding/media' },
                    tags: { type: 'string', example: 'wedding,api' }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'Create media success' } }
        },
        get: {
          tags: ['Media Upload'],
          summary: 'List media assets',
          parameters: [
            {
              in: 'query',
              name: 'resourceType',
              required: false,
              schema: { type: 'string', example: 'image' }
            },
            {
              in: 'query',
              name: 'maxResults',
              required: false,
              schema: { type: 'integer', example: 20 }
            },
            {
              in: 'query',
              name: 'prefix',
              required: false,
              schema: { type: 'string', example: 'wedding/media' }
            }
          ],
          responses: { 200: { description: 'List media success' } }
        }
      },
      '/api/media-upload/one': {
        get: {
          tags: ['Media Upload'],
          summary: 'Get media by publicId',
          parameters: [
            {
              in: 'query',
              name: 'publicId',
              required: true,
              schema: { type: 'string', example: 'wedding/media/sample_public_id' }
            },
            {
              in: 'query',
              name: 'resourceType',
              required: false,
              schema: { type: 'string', example: 'image' }
            }
          ],
          responses: { 200: { description: 'Get media success' } }
        },
        put: {
          tags: ['Media Upload'],
          summary: 'Update media by publicId',
          parameters: [
            {
              in: 'query',
              name: 'publicId',
              required: true,
              schema: { type: 'string', example: 'wedding/media/sample_public_id' }
            },
            {
              in: 'query',
              name: 'resourceType',
              required: false,
              schema: { type: 'string', example: 'image' }
            }
          ],
          requestBody: {
            required: false,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    resourceType: { type: 'string', example: 'image' },
                    folder: { type: 'string', example: 'wedding/media' },
                    tags: { type: 'string', example: 'wedding,updated' },
                    newPublicId: { type: 'string', example: 'wedding/media/sample_public_id_new' }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'Update media success' } }
        },
        delete: {
          tags: ['Media Upload'],
          summary: 'Delete media by publicId',
          parameters: [
            {
              in: 'query',
              name: 'publicId',
              required: true,
              schema: { type: 'string', example: 'wedding/media/sample_public_id' }
            },
            {
              in: 'query',
              name: 'resourceType',
              required: false,
              schema: { type: 'string', example: 'image' }
            }
          ],
          responses: { 200: { description: 'Delete media success' } }
        }
      }
    }
  },
  apis: []
};

module.exports = swaggerJSDoc(options);

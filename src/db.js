const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL in environment variables');
}

const pool = new Pool({ connectionString });

async function bootstrapDatabase() {
  const sql = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS guest (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS private_invitation (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      guest_id UUID UNIQUE,
      url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT fk_inv_guest
        FOREIGN KEY (guest_id)
        REFERENCES guest(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages_checkins (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      guest_id UUID NULL,
      name_guest TEXT NOT NULL,
      messages TEXT,
      confirm_attendance TEXT,
      number_of_attendees INTEGER,
      guests_type TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT fk_msg_guest
        FOREIGN KEY (guest_id)
        REFERENCES guest(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_guest_id
      ON messages_checkins(guest_id);

    CREATE INDEX IF NOT EXISTS idx_invitation_guest_id
      ON private_invitation(guest_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_private_invitation_url
      ON private_invitation(url);
  `;

  await pool.query(sql);
}

module.exports = {
  pool,
  bootstrapDatabase,
};
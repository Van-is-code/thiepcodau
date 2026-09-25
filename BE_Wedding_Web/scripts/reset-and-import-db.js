const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = path.join(__dirname, '..');
const sqlPath = path.join(root, 'database.sql');

const adminConfig = {
  user: 'postgres',
  password: '2',
  host: 'localhost',
  port: 5432,
  database: 'postgres'
};

const dbConfig = {
  user: 'postgres',
  password: '2',
  host: 'localhost',
  port: 5432,
  database: 'Wedding_Web'
};

const run = async () => {
  const admin = new Client(adminConfig);
  await admin.connect();

  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'Wedding_Web' AND pid <> pg_backend_pid();");
  await admin.query('DROP DATABASE IF EXISTS "Wedding_Web";');
  await admin.query('CREATE DATABASE "Wedding_Web";');
  await admin.end();

  const rawSql = fs.readFileSync(sqlPath, 'utf8');
  const sql = rawSql
    .replace(/BLOB\(1\)/g, 'BOOLEAN')
    .replace(/"is_cover" BOOLEAN NOT NULL DEFAULT 0/g, '"is_cover" BOOLEAN NOT NULL DEFAULT FALSE')
    .replace(/ALTER TABLE[\s\S]*?;/g, '');

  const db = new Client(dbConfig);
  await db.connect();
  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await db.query(sql);
  await db.end();

  console.log('DB_RESET_AND_IMPORT_OK');
};

run().catch((error) => {
  console.error('DB_RESET_AND_IMPORT_FAIL');
  console.error(error.message);
  process.exit(1);
});

-- Vai trò CHỈ-ĐỌC cho thiep-backup (pg_dump không cần quyền ghi).
-- Chạy bằng superuser:  psql -U postgres -f scripts/backup/sql/backup-role.sql
-- Nhớ đổi mật khẩu và điền vào PGPASSWORD trong backup.env.

\set db 'Wedding_Web'
\set bkpass 'DOI_MAT_KHAU_NAY'

CREATE ROLE thiep_backup WITH LOGIN PASSWORD :'bkpass';
GRANT CONNECT ON DATABASE :"db" TO thiep_backup;

\connect :"db"

GRANT USAGE ON SCHEMA public TO thiep_backup;
GRANT SELECT ON ALL TABLES    IN SCHEMA public TO thiep_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO thiep_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES    TO thiep_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO thiep_backup;

-- pg_stat_user_tables (tín hiệu phát hiện thay đổi) đã mở cho mọi user, không cần grant thêm.

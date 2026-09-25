#!/usr/bin/env bash
# Cài đặt thiep-backup (chạy bằng sudo). Idempotent — chạy lại được.
#   sudo bash scripts/backup/install.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

BIN=/opt/thiep-backup
ETC=/etc/thiep-backup
VAR=/var/lib/thiep-backup

echo "==> Tạo thư mục"
install -d -m 755 "$BIN"
install -d -m 750 "$ETC"
install -d -m 750 "$VAR"

echo "==> Copy script"
install -m 755 "$HERE/thiep-backup" "$BIN/thiep-backup"

echo "==> File cấu hình"
if [ ! -f "$ETC/backup.env" ]; then
  install -m 600 "$HERE/backup.env.example" "$ETC/backup.env"
  echo "    -> ĐÃ TẠO $ETC/backup.env  (HÃY MỞ RA ĐIỀN)"
else
  echo "    -> $ETC/backup.env đã có, giữ nguyên."
fi

echo "==> User hệ thống 'thiepbackup'"
id thiepbackup >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin thiepbackup || true
chown -R thiepbackup:thiepbackup "$VAR" || true
chgrp -R thiepbackup "$ETC" 2>/dev/null || true

echo "==> Kiểm công cụ"
for c in restic rclone pg_dump psql curl flock; do
  command -v "$c" >/dev/null 2>&1 && echo "    ok  $c" || echo "    !! THIẾU $c"
done

cat <<EOF

==> Bước tiếp theo (thủ công):
  1. Điền $ETC/backup.env
  2. rclone config --config $ETC/rclone.conf        # tạo remote 'gdrive'
  3. openssl rand -base64 32 > $ETC/restic.pass ; chmod 600 $ETC/restic.pass
     (LƯU MỘT BẢN NGOÀI SERVER — mất là mất backup)
  4. psql -U postgres -f $HERE/sql/backup-role.sql  # tạo role chỉ-đọc
  5. $BIN/thiep-backup init
  6. $BIN/thiep-backup run                          # thử 1 lần
  7. systemd:  sudo cp $HERE/systemd/*.{service,timer} /etc/systemd/system/
               sudo systemctl daemon-reload
               sudo systemctl enable --now thiep-backup thiep-backup-check.timer
     hoặc pm2: pm2 start $HERE/pm2.ecosystem.cjs && pm2 save
EOF

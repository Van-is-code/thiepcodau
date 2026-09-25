# thiep-backup — sao lưu lên Google Drive

Sao lưu **PostgreSQL + file đĩa** (`uploads/`, `media/`, `.env`) lên Google Drive bằng
**restic** (dedup + nén + mã hoá) qua **rclone**.

- **Kích hoạt theo thay đổi + điều tiết**: watcher kiểm mỗi 60s; có thay đổi *và* đã qua
  5 phút kể từ backup trước → chạy. Không đổi → không chạy.
- **Mốc mỗi ngày**: luôn có ít nhất 1 bản/ngày lúc `ANCHOR_HOUR`.
- **Giữ 3 ngày** (`KEEP_WITHIN=72h`) — mọi snapshot trong 3 ngày đều còn; sau đó prune.
- **Bản DB “mới nhất”** (`db.dump.gz`) ghi đè mỗi lần → khôi phục DB gấp không cần restic.

## Có gì trong thư mục này

| File | |
|---|---|
| `thiep-backup` | script chính (init / run / watch / snapshots / status / check / restore) |
| `backup.env.example` | mẫu cấu hình → copy sang `/etc/thiep-backup/backup.env` |
| `install.sh` | cài đặt nhanh (sudo) |
| `systemd/thiep-backup.service` | watcher chạy nền |
| `systemd/thiep-backup-check.{service,timer}` | `restic check` hằng tuần |
| `pm2.ecosystem.cjs` | chạy watcher bằng pm2 (thay systemd) |
| `sql/backup-role.sql` | tạo role Postgres chỉ-đọc `thiep_backup` |

## Cài (tóm tắt)

```bash
# 1. Công cụ (mỗi cái 1 binary)
curl https://rclone.org/install.sh | sudo bash
curl -L https://github.com/restic/restic/releases/latest/download/restic_linux_amd64.bz2 \
  | bunzip2 | sudo tee /usr/local/bin/restic >/dev/null && sudo chmod +x /usr/local/bin/restic

# 2. Cài script
sudo bash scripts/backup/install.sh

# 3. Cấu hình (bạn làm — xem hướng dẫn install.sh in ra)
sudo nano /etc/thiep-backup/backup.env
sudo rclone config --config /etc/thiep-backup/rclone.conf     # remote tên 'gdrive'
openssl rand -base64 32 | sudo tee /etc/thiep-backup/restic.pass && sudo chmod 600 /etc/thiep-backup/restic.pass
psql -U postgres -f scripts/backup/sql/backup-role.sql

# 4. Khởi tạo + thử
sudo -u thiepbackup /opt/thiep-backup/thiep-backup init
sudo -u thiepbackup /opt/thiep-backup/thiep-backup run
sudo -u thiepbackup /opt/thiep-backup/thiep-backup status

# 5. Chạy nền
sudo cp scripts/backup/systemd/*.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thiep-backup thiep-backup-check.timer
journalctl -u thiep-backup -f
```

## rclone config cho Google Drive (điểm hay sai)

- Dùng **tài khoản Google riêng cho backup**, bật 2FA.
- Tạo **OAuth client ID riêng** (console.cloud.google.com → bật Google Drive API →
  OAuth consent screen **PUBLISH** (không để *Testing*, không thì token chết sau 7 ngày) →
  Credentials → OAuth client ID kiểu **Desktop**). Điền `client_id` / `client_secret` khi `rclone config`.
- `scope`: chọn `3` (`drive.file` — rclone chỉ đụng file nó tạo, an toàn nhất).
- VPS không có trình duyệt → khi hỏi *Use auto config?* chọn `n`, chạy lệnh `rclone authorize`
  nó in ra **trên máy cá nhân**, dán token ngược lại.

## Khôi phục

```bash
# DB gấp (từ bản "mới nhất") -> vào DB phụ, KHÔNG đụng DB live
thiep-backup restore db latest
# -> tạo DB "Wedding_Web_restore", kiểm tra rồi tự đổi tên/swap

# DB từ 1 snapshot cụ thể
thiep-backup snapshots
thiep-backup restore db <snapshot-id>

# Ghi đè thẳng DB live (nguy hiểm — phải gõ xác nhận)
thiep-backup restore db <snapshot-id> --target-db Wedding_Web

# File
thiep-backup restore files <snapshot-id> --to /srv/restore
# rồi rsync /srv/restore/.../uploads/  vào chỗ thật
```

## Lưu ý quan trọng

- **`RESTIC_PASSWORD` mất = mất sạch backup** (kho chỉ là ciphertext). Cất một bản NGOÀI server.
- **Chỉ Drive là một điểm** — account bị khoá là mất. Khi dự án lớn: thêm đích thứ 2
  (Cloudflare R2 / B2) append-only, chạy `restic copy` hằng tuần.
- Backup **chưa test restore = chưa phải backup**. `thiep-backup-check.timer` lo integrity;
  mỗi tháng tự `thiep-backup restore db <id>` ra DB phụ để chắc.
- Kho backup đặt ở `/etc` + `/var/lib` — **không** nằm trong thư mục dự án, **không** trong Docker volume.

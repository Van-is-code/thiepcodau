#!/usr/bin/env bash
#
# deploy.sh — chạy thiepminh trên máy chủ nhà bằng PM2 (không dùng Docker).
#
# Chép tệp này vào thư mục mã nguồn trên máy chủ rồi chạy. Nó tự sinh tệp .env,
# cài phụ thuộc, chạy migration, build giao diện và bật PM2.
#
#   ./deploy.sh up        lần đầu: cài, migrate, build, bật
#   ./deploy.sh update    kéo mã mới, cài lại, migrate, build, khởi động lại
#   ./deploy.sh seed      tạo tài khoản admin (chỉ lần đầu)
#   ./deploy.sh backup    sao lưu CSDL + thư mục uploads/media
#   ./deploy.sh restore <tệp>  khôi phục từ bản sao lưu
#   ./deploy.sh logs [ten]     xem log
#   ./deploy.sh ps             trạng thái tiến trình
#   ./deploy.sh restart        khởi động lại cả hai
#   ./deploy.sh stop           dừng (dữ liệu còn nguyên)
#   ./deploy.sh doctor         kiểm máy đủ điều kiện chưa
#
# Kiến trúc:
#
#   Cloudflare Tunnel ──> :1001  thiepminh-web  (giao diện đã build)
#                                      │ /api /uploads /templates /media
#                                      ▼
#                                :1000  thiepminh-api  (Express)
#                                      │
#                                PostgreSQL :5432 (chỉ nghe localhost)
#
# Giao diện và API chung một cổng nên trình duyệt thấy cùng tên miền: không dính
# CORS, và bản build KHÔNG chứa tên miền nào — thêm tên miền lúc nào cũng được,
# không phải dựng lại.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BE="$GOC/BE_Wedding_Web"
FE="$GOC/FE_Wedding_Web"
TEP_ENV="$BE/.env"

CONG_BE="${CONG_BE:-1000}"
CONG_FE="${CONG_FE:-1001}"

do_="\033[0;31m"; xanh="\033[0;32m"; vang="\033[0;33m"; lam="\033[0;36m"; het="\033[0m"
noi()  { printf "${lam}==>${het} %s\n" "$*"; }
duoc() { printf "${xanh} ok ${het} %s\n" "$*"; }
canh() { printf "${vang} !! ${het} %s\n" "$*"; }
chet() { printf "${do_} xx ${het} %s\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Kiểm tra tiền đề
# ---------------------------------------------------------------------------
kiem_tra_may() {
  command -v node >/dev/null 2>&1 || chet "Chưa có Node.js. Cài Node 20 trở lên."
  local v; v="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$v" -ge 20 ] || chet "Node $v quá cũ. Cần Node 20 trở lên (sharp và fetch cần)."

  command -v npm >/dev/null 2>&1 || chet "Chưa có npm."
  command -v pm2 >/dev/null 2>&1 || chet "Chưa có PM2. Cài: sudo npm install -g pm2"

  [ -d "$BE" ] && [ -d "$FE" ] \
    || chet "Chạy tệp này ở thư mục gốc mã nguồn (nơi có BE_Wedding_Web và FE_Wedding_Web)."

  # Postgres phải sống thì mới migrate được.
  if ! command -v psql >/dev/null 2>&1; then
    canh "Không thấy lệnh psql. Nếu Postgres chạy ở máy khác thì bỏ qua."
  fi
}

tim_ip_lan() {
  hostname -I 2>/dev/null | awk '{print $1}' \
    || ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' \
    || echo "127.0.0.1"
}

sinh_chuoi() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "${1:-32}"
  else head -c "$((${1:-32} * 2))" /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-"$((${1:-32} * 2))"
  fi
}

doc_env() { grep -E "^$1=" "$TEP_ENV" 2>/dev/null | head -1 | cut -d= -f2-; }

# ---------------------------------------------------------------------------
# Tệp .env — sinh lần đầu, sau đó KHÔNG ghi đè
# ---------------------------------------------------------------------------
tao_env() {
  if [ -f "$TEP_ENV" ]; then duoc "Đã có $TEP_ENV, giữ nguyên"; return; fi

  local ip mk
  ip="$(tim_ip_lan)"
  mk="$(sinh_chuoi 24)"

  noi "Sinh $TEP_ENV lần đầu"
  cat > "$TEP_ENV" <<ENV_EOF
# Sinh tự động bởi deploy.sh — sửa tay được, nhưng ĐỪNG đẩy lên git.

NODE_ENV=production
PORT=$CONG_BE

# --- CSDL: PostgreSQL cài thẳng trên máy này ---
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=thiepminh
DB_USER=thiepminh
DB_PASSWORD=$mk

# --- Khoá bí mật (sinh ngẫu nhiên, đừng chia sẻ) ---
JWT_SECRET=$(sinh_chuoi 48)
GUEST_LINK_SECRET=$(sinh_chuoi 32)
JWT_EXPIRES_IN=7d

# --- Địa chỉ ---
# CHƯA CÓ TÊN MIỀN cũng chạy được: giao diện gọi API theo tên miền đang mở, nên
# lúc nào thêm tên miền vào Cloudflare Tunnel thì chỉ cần thêm vào CORS_ORIGINS
# rồi "./deploy.sh restart" — KHÔNG phải build lại.
CORS_ORIGINS=http://localhost:$CONG_FE,http://$ip:$CONG_FE
FRONTEND_URL=http://$ip:$CONG_FE
API_PUBLIC_URL=
PUBLIC_INVITATION_BASE_URL=

TZ=Asia/Ho_Chi_Minh
TRUST_PROXY_HOPS=1

ALLOW_PUBLIC_REGISTER=false
ENABLE_SLOT_PURCHASE=false

# --- Lưu ảnh và nhạc: trên ổ máy này. Đổi sang r2 xem HUONG_DAN_R2.md ---
STORAGE_DRIVER=local
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=

# --- Thanh toán payOS (để trống thì phần nạp lượt không dùng được) ---
PAYOS_MOCK=false
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_ORDER_TTL_HOURS=24

# Chi hộ. Hai giá trị dưới chỉ là mặc định LẦN ĐẦU — sau đó bật/tắt ở trang
# quản trị (Phiếu Rút -> Chính sách rút tiền).
PAYOS_PAYOUT_MOCK=false
PAYOS_PAYOUT_CLIENT_ID=
PAYOS_PAYOUT_API_KEY=
PAYOS_PAYOUT_CHECKSUM_KEY=
PAYOUT_MODE=manual
AUTO_PAYOUT_ENABLED=false
AUTO_PAYOUT_INTERVAL_MS=900000

# --- Gửi thư mời: Gmail + mật khẩu ứng dụng ---
GMAIL_USER=
GMAIL_PASSWORD=

# --- Báo động Telegram (để trống là tắt) ---
TELEGRAM_ENABLED=false
TELEGRAM_ALERT_BOT_TOKEN=
TELEGRAM_ALERT_CHAT_ID=
ENV_EOF
  chmod 600 "$TEP_ENV"
  duoc "Đã sinh khoá bí mật ngẫu nhiên, tệp để quyền 600"
  canh "Tạo CSDL khớp với tệp này:"
  echo "      sudo -u postgres psql -c \"CREATE USER thiepminh WITH PASSWORD '$mk';\""
  echo "      sudo -u postgres psql -c \"CREATE DATABASE thiepminh OWNER thiepminh;\""
}

bao_ve_gitignore() {
  [ -d "$GOC/.git" ] || return 0
  local f="$GOC/.gitignore" d
  touch "$f"
  for d in "BE_Wedding_Web/.env" "logs/" "backup/" "FE_Wedding_Web/dist/"; do
    grep -qxF "$d" "$f" 2>/dev/null || echo "$d" >> "$f"
  done
}

noi_duoc_db() {
  (cd "$BE" && node -e '
    require("dotenv").config();
    const { Sequelize } = require("sequelize");
    const c = require("./src/database/config.js").production;
    new Sequelize(c.database, c.username, c.password,
      { host: c.host, port: c.port, dialect: "postgres", logging: false })
      .authenticate().then(() => process.exit(0)).catch(() => process.exit(1));
  ' >/dev/null 2>&1)
}

cai_phu_thuoc() {
  # npm ci cần package-lock.json và cài đúng bản đã khoá — chắc chắn hơn npm install.
  noi "Cài phụ thuộc backend"
  (cd "$BE" && npm ci --omit=dev --no-audit --no-fund)

  noi "Cài phụ thuộc giao diện (cần cả devDependencies để build)"
  (cd "$FE" && npm ci --no-audit --no-fund)
}

migrate() {
  noi "Chạy migration CSDL"
  noi_duoc_db || chet "Không nối được CSDL. Kiểm PostgreSQL và phần DB_* trong $TEP_ENV"
  (cd "$BE" && NODE_ENV=production npx sequelize-cli db:migrate) \
    || chet "Migration thất bại."
  duoc "CSDL đã ở phiên bản mới nhất"
}

build_fe() {
  # same-origin = giao diện gọi API theo tên miền đang mở. Nhờ vậy bản build
  # không dính cứng tên miền nào, thêm tên miền sau không phải build lại.
  noi "Build giao diện"
  (cd "$FE" && VITE_API_URL=same-origin npm run build) || chet "Build giao diện thất bại."
  [ -f "$FE/dist/index.html" ] || chet "Build xong nhưng không thấy dist/index.html"
  duoc "Đã build vào $FE/dist"
}

bat_pm2() {
  mkdir -p "$GOC/logs"
  noi "Bật PM2"
  (cd "$GOC" && CONG_BE="$CONG_BE" CONG_FE="$CONG_FE" pm2 startOrReload ecosystem.config.cjs --update-env)
  pm2 save >/dev/null 2>&1 || true
  duoc "Đã lưu danh sách tiến trình (pm2 save)"
}

ma_http() {
  if command -v curl >/dev/null 2>&1; then
    curl -s -o /dev/null -m 5 -w '%{http_code}' "$1" 2>/dev/null || echo 000
  elif command -v wget >/dev/null 2>&1; then
    wget -q -S -O /dev/null -T 5 "$1" 2>&1 | awk '/HTTP\//{c=$2} END{print (c?c:"000")}'
  else echo "---"; fi
}

kiem_tra_song() {
  noi "Đợi hệ thống sẵn sàng"
  local i=0 ma=000
  while [ "$i" -lt 40 ]; do
    ma=$(ma_http "http://127.0.0.1:$CONG_FE/")
    if [ "$ma" = "200" ] || [ "$ma" = "---" ]; then break; fi
    i=$((i + 1)); sleep 2
  done
  echo

  if [ "$ma" = "---" ]; then
    canh "Máy không có curl lẫn wget nên không tự kiểm được."
  elif [ "$ma" = "200" ]; then
    duoc "Giao diện: http://127.0.0.1:$CONG_FE"
    local api proxy
    api=$(ma_http "http://127.0.0.1:$CONG_BE/api/invitation-templates")
    proxy=$(ma_http "http://127.0.0.1:$CONG_FE/api/invitation-templates")
    if [ "$api" -lt 500 ] 2>/dev/null; then duoc "API: http://127.0.0.1:$CONG_BE (HTTP $api)"
    else canh "API trả HTTP $api — xem: ./deploy.sh logs thiepminh-api"; fi
    # Đường mà khách mời thật sự đi. Hỏng đường này là thiệp trắng trang.
    if [ "$proxy" -lt 500 ] 2>/dev/null; then duoc "Giao diện chuyển /api sang API: OK"
    else canh "Giao diện KHÔNG chuyển được /api (HTTP $proxy) — khách sẽ thấy thiệp trắng."; fi
  else
    canh "Chưa lên (HTTP $ma). Xem: ./deploy.sh logs"
  fi

  echo
  noi "Trỏ Cloudflare Tunnel vào http://localhost:$CONG_FE"
  echo "      Chưa có tên miền vẫn chạy được — thêm lúc nào cũng được, KHÔNG phải build lại."
  echo "      Thêm xong nhớ bổ sung tên miền vào CORS_ORIGINS trong $TEP_ENV rồi './deploy.sh restart'."
  echo
  pm2 list
}

lenh_up() {
  kiem_tra_may
  tao_env
  bao_ve_gitignore
  cai_phu_thuoc
  migrate
  build_fe
  bat_pm2
  kiem_tra_song
  echo
  noi "Việc cần làm tiếp"
  echo "      1. ./deploy.sh seed   — tạo tài khoản admin (chỉ lần đầu)"
  echo "      2. pm2 startup        — in ra lệnh để PM2 tự bật lại sau khi khởi động máy"
  echo "      3. Điền khoá payOS / Gmail vào $TEP_ENV rồi './deploy.sh restart'"
  echo "      4. Hẹn giờ sao lưu:  crontab -e"
  echo "         0 3 * * * cd $GOC && ./deploy.sh backup >> $GOC/logs/backup.log 2>&1"
}

lenh_update() {
  kiem_tra_may
  if [ -d "$GOC/.git" ] && [ "${KHONG_PULL:-}" != "1" ]; then
    noi "Kéo mã mới"
    git -C "$GOC" pull --ff-only || canh "git pull không chạy được, dùng mã đang có."
  fi
  cai_phu_thuoc
  migrate
  build_fe
  bat_pm2
  kiem_tra_song
}

# Seeder trong kho đặt mật khẩu admin là "admin123". Để nguyên trên máy chủ chạy
# thật là mời người lạ vào, nên seed xong đổi ngay sang chuỗi ngẫu nhiên và in ra
# đúng một lần.
lenh_seed() {
  kiem_tra_may
  noi_duoc_db || chet "Không nối được CSDL."
  noi "Tạo dữ liệu khởi tạo"
  (cd "$BE" && NODE_ENV=production npx sequelize-cli db:seed:all) \
    || canh "Seed báo lỗi (thường do đã chạy rồi) — vẫn thử đổi mật khẩu admin."

  local mk; mk="$(sinh_chuoi 9)"
  if (cd "$BE" && MK_MOI="$mk" node -e '
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Sequelize } = require("sequelize");
const c = require("./src/database/config.js").production;
(async () => {
  const s = new Sequelize(c.database, c.username, c.password,
    { host: c.host, port: c.port, dialect: "postgres", logging: false });
  const bam = await bcrypt.hash(process.env.MK_MOI, 12);
  const [, meta] = await s.query(
    "UPDATE users SET password = :p, updated_at = NOW() WHERE username = :u",
    { replacements: { p: bam, u: "admin" } });
  await s.close();
  if (!meta || meta.rowCount !== 1) process.exit(1);
})();
  ' >/dev/null 2>&1); then
    echo
    printf "${xanh}  ┌──────────────────────────────────────────────┐${het}\n"
    printf "${xanh}  │${het}  Tài khoản quản trị                          ${xanh}│${het}\n"
    printf "${xanh}  │${het}    tên đăng nhập : admin                     ${xanh}│${het}\n"
    printf "${xanh}  │${het}    mật khẩu      : %-24s ${xanh}│${het}\n" "$mk"
    printf "${xanh}  └──────────────────────────────────────────────┘${het}\n"
    canh "Chép lại ngay — script không lưu mật khẩu này ở đâu cả."
  else
    canh "Không đổi được mật khẩu admin tự động."
    canh "Tài khoản đang là admin/admin123 — ĐĂNG NHẬP VÀ ĐỔI NGAY."
  fi
}

lenh_backup() {
  local thu_muc="$GOC/backup" dau
  mkdir -p "$thu_muc"
  dau="$(date +%Y%m%d-%H%M%S)"

  noi "Sao lưu CSDL"
  PGPASSWORD="$(doc_env DB_PASSWORD)" pg_dump \
    -h "$(doc_env DB_HOST)" -p "$(doc_env DB_PORT)" \
    -U "$(doc_env DB_USER)" -d "$(doc_env DB_NAME)" --clean --if-exists \
    | gzip > "$thu_muc/db-$dau.sql.gz"

  # Ảnh để trên R2 thì Cloudflare lo phần bền vững, khỏi sao lưu lại cho nặng ổ.
  if [ "$(doc_env STORAGE_DRIVER)" = "r2" ]; then
    noi "Ảnh đang ở R2 — chỉ sao lưu nhạc/tệp cục bộ"
    tar czf "$thu_muc/uploads-$dau.tar.gz" -C "$BE" media 2>/dev/null || true
  else
    noi "Sao lưu ảnh, nhạc và gói theme"
    tar czf "$thu_muc/uploads-$dau.tar.gz" -C "$BE" uploads media 2>/dev/null || true
  fi

  ls -1t "$thu_muc"/db-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
  ls -1t "$thu_muc"/uploads-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
  duoc "Xong: $thu_muc/db-$dau.sql.gz + uploads-$dau.tar.gz"

  local dung; dung=$(du -sm "$thu_muc" 2>/dev/null | awk '{print $1}')
  [ "${dung:-0}" -gt 20000 ] && canh "Thư mục sao lưu đã ${dung}MB — cân nhắc chuyển ảnh lên R2."
  return 0
}

lenh_restore() {
  local tep="${1:-}"
  [ -f "$tep" ] || chet "Dùng: ./deploy.sh restore backup/db-YYYYmmdd-HHMMSS.sql.gz"
  canh "Sẽ GHI ĐÈ toàn bộ CSDL hiện tại bằng $tep"
  printf "      Gõ 'dong y' để tiếp tục: "
  local tra; read -r tra
  [ "$tra" = "dong y" ] || chet "Đã huỷ."

  # Dừng backend trước: khôi phục trong khi vẫn có người ghi là hỏng cả hai bên.
  noi "Tạm dừng backend"
  pm2 stop thiepminh-api >/dev/null 2>&1 || true

  gunzip -c "$tep" | PGPASSWORD="$(doc_env DB_PASSWORD)" psql \
    -h "$(doc_env DB_HOST)" -p "$(doc_env DB_PORT)" \
    -U "$(doc_env DB_USER)" -d "$(doc_env DB_NAME)" >/dev/null
  duoc "Đã khôi phục CSDL"

  local anh; anh="$(echo "$tep" | sed 's/db-/uploads-/; s/\.sql\.gz$/.tar.gz/')"
  if [ -f "$anh" ]; then
    tar xzf "$anh" -C "$BE"
    duoc "Đã khôi phục ảnh, nhạc và gói theme"
  else
    canh "Không thấy $anh — chỉ khôi phục CSDL. Thiệp sẽ thiếu ảnh."
  fi

  noi "Bật lại backend"
  pm2 start thiepminh-api >/dev/null 2>&1 || true
}

lenh_doctor() {
  kiem_tra_may
  duoc "Node $(node -v) · npm $(npm -v) · PM2 $(pm2 -v 2>/dev/null)"
  echo "      IP trong mạng: $(tim_ip_lan)"
  echo "      Cổng: giao diện $CONG_FE · API $CONG_BE"

  for c in "$CONG_FE" "$CONG_BE"; do
    if command -v ss >/dev/null 2>&1; then
      if ss -ltn 2>/dev/null | grep -q ":$c "; then duoc "cổng $c đang có tiến trình lắng nghe"
      else echo "      cổng $c đang rảnh"; fi
    fi
  done

  if [ -f "$TEP_ENV" ]; then
    duoc "Có $TEP_ENV"
    local kha; kha="$(doc_env JWT_SECRET)"
    [ "${#kha}" -ge 32 ] && duoc "JWT_SECRET dài ${#kha} ký tự" \
      || canh "JWT_SECRET quá ngắn — backend sẽ từ chối khởi động."
    if noi_duoc_db; then duoc "Nối được CSDL"; else canh "KHÔNG nối được CSDL — kiểm phần DB_* và PostgreSQL."; fi
    [ -n "$(doc_env PAYOS_CLIENT_ID)" ] && duoc "Thu hộ payOS: đã có khoá" \
      || canh "Thu hộ payOS: chưa có khoá — khách không nạp lượt được."
    [ -n "$(doc_env GMAIL_USER)" ] && duoc "Đã cấu hình Gmail" \
      || canh "Chưa có GMAIL_USER/GMAIL_PASSWORD — không gửi được thư mời."
    echo "      CORS_ORIGINS=$(doc_env CORS_ORIGINS)"
  else
    canh "Chưa có $TEP_ENV (sẽ sinh khi chạy 'up')."
  fi

  [ -f "$FE/dist/index.html" ] && duoc "Giao diện đã build" || canh "Chưa build giao diện."
  echo
  pm2 list 2>/dev/null || true
}

lenh_help() { sed -n '3,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

# ---------------------------------------------------------------------------
case "${1:-up}" in
  up)       lenh_up ;;
  update)   lenh_update ;;
  seed)     lenh_seed ;;
  backup)   lenh_backup ;;
  restore)  shift; lenh_restore "${1:-}" ;;
  logs)     shift; pm2 logs "${1:-}" --lines 100 ;;
  ps)       pm2 list ;;
  restart)  pm2 restart ecosystem.config.cjs --update-env 2>/dev/null || pm2 restart all; duoc "Đã khởi động lại" ;;
  stop)     pm2 stop thiepminh-api thiepminh-web; duoc "Đã dừng. Dữ liệu còn nguyên, bật lại bằng 'up'." ;;
  build)    build_fe ;;
  doctor)   lenh_doctor ;;
  help|-h|--help) lenh_help ;;
  *)        chet "Lệnh lạ: $1 — chạy './deploy.sh help' để xem danh sách." ;;
esac

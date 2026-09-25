#!/bin/sh
# Chờ DB sẵn sàng rồi mới migrate + start server — để "docker compose up" là chạy được
# ngay, không cần thao tác tay. Không dùng cho non-Docker (npm run dev/start vẫn như cũ).
set -e

echo "Applying database migrations..."
ATTEMPTS=0
MAX_ATTEMPTS=30

until npx sequelize-cli db:migrate; do
	ATTEMPTS=$((ATTEMPTS + 1))
	if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
		echo "Database still not ready after $MAX_ATTEMPTS attempts, giving up."
		exit 1
	fi
	echo "DB not ready yet, retrying in 2s... ($ATTEMPTS/$MAX_ATTEMPTS)"
	sleep 2
done

echo "Migrations applied. Starting server (nodemon, hot-reload on)..."
# --legacy-watch (polling): bind mount qua Docker Desktop trên Windows/Mac không phát
# sự kiện inotify đáng tin cậy, nodemon mặc định sẽ không thấy file đổi nếu thiếu cờ này.
exec npx nodemon --legacy-watch src/server.js

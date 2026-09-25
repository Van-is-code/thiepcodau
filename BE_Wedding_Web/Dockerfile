FROM node:20-alpine

WORKDIR /app

# Cài dependencies trước để tận dụng cache layer khi chỉ đổi code
# Cài cả devDependencies vì entrypoint dùng nodemon để hot-reload khi test qua Docker
COPY package*.json ./
RUN npm install

COPY . .

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]

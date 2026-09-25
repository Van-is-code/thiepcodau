# Dockerfile chạy chế độ dev (hot-reload) để tiện test — không phải build production.
# Muốn build production thì dùng "npm run build" rồi serve dist/ qua nginx riêng.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

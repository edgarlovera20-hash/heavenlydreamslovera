FROM node:20-alpine
WORKDIR /app
COPY apps/telegram-service/package.json ./
RUN npm install --omit=dev
COPY apps/telegram-service/src ./src
EXPOSE 4004
CMD ["npx", "tsx", "src/index.ts"]

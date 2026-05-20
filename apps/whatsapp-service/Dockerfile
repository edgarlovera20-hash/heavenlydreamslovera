FROM node:20-alpine
RUN apk add --no-cache libc6-compat chromium git
WORKDIR /app
COPY apps/whatsapp-service/package.json ./
RUN npm install --omit=dev
COPY apps/whatsapp-service/src ./src
EXPOSE 4001
CMD ["npx", "tsx", "src/index.ts"]

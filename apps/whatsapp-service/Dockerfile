FROM node:20-alpine
RUN apk add --no-cache libc6-compat chromium
WORKDIR /app
COPY apps/whatsapp-service/package.json ./
RUN npm ci
COPY apps/whatsapp-service/src ./src
EXPOSE 4001
CMD ["npx", "tsx", "src/index.ts"]

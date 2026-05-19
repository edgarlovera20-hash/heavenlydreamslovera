FROM node:20-alpine
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY apps/ocr-service/package.json ./
RUN npm ci
COPY apps/ocr-service/src ./src
EXPOSE 4002
CMD ["npx", "tsx", "src/index.ts"]

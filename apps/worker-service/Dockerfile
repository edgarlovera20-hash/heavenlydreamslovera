FROM node:20-alpine
WORKDIR /app
COPY apps/worker-service/package.json ./
RUN npm install --omit=dev
COPY apps/worker-service/src ./src
CMD ["npx", "tsx", "src/index.ts"]

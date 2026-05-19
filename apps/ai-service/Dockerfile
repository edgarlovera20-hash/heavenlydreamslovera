FROM node:20-alpine
WORKDIR /app
COPY apps/ai-service/package.json ./
RUN npm ci
COPY apps/ai-service/src ./src
EXPOSE 4003
CMD ["npx", "tsx", "src/index.ts"]

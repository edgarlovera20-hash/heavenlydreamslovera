FROM node:20-alpine
WORKDIR /app
COPY apps/phone-validation-service/package.json ./
RUN npm ci
COPY apps/phone-validation-service/src ./src
EXPOSE 4005
CMD ["npx", "tsx", "src/index.ts"]

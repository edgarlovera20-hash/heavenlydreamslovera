FROM node:20-alpine
WORKDIR /app
COPY apps/email-validation-service/package.json ./
RUN npm ci
COPY apps/email-validation-service/src ./src
EXPOSE 4006
CMD ["npx", "tsx", "src/index.ts"]

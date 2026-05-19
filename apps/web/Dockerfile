FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
RUN npm ci --workspace=apps/web --workspace=packages/types --workspace=packages/ui

COPY packages/types ./packages/types
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
RUN cd apps/web && npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/web/server.js"]

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @smart-cam/api prisma generate
RUN pnpm --filter @smart-cam/api build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl bash
COPY --from=build /app /app
WORKDIR /app/apps/api

# Run migrations at start then boot API
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

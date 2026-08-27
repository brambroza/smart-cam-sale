FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile || pnpm install
# pnpm --filter <pkg> <name> resolves <name> as a package.json script, not a
# binary — use `exec` to run the prisma CLI itself and `run` to run the build
# script explicitly.
RUN pnpm --filter @smart-cam/api exec prisma generate
RUN pnpm --filter @smart-cam/api run build
# Fail loudly if nest build didn't actually produce dist/main.js — otherwise
# the runtime stage crashes on Cannot find module.
RUN test -f /app/apps/api/dist/main.js || (echo "❌ dist/main.js missing after build" && ls -la /app/apps/api/ && exit 1)

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl bash
COPY --from=build /app /app
WORKDIR /app/apps/api

# Run migrations at start then boot API
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

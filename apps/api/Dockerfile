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
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]

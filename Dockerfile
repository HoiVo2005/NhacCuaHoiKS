# =============================================================================
# MyMusic - Dockerfile (Next.js 16 standalone + Prisma 7 / PostgreSQL)
# =============================================================================
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Cai dat dependencies ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ung dung ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma generate chi can schema, khong can ket noi that (gia tri duoi day chi de build)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?sslmode=disable"
RUN npx prisma generate
RUN npm run build

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# KHONG dat cung cong o day: cac nen tang (Render, Fly, Railway...) tu cap bien PORT va yeu cau
# ung dung bind dung cong do. Cong 3000 chi la gia tri MAC DINH khi chay local (xem CMD).

RUN apk add --no-cache libc6-compat curl

# node_modules day du: vua de chay prisma migrate deploy, vua de chay next start
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/scripts/docker-start.cjs ./scripts/docker-start.cjs
COPY --from=builder /app/scripts/unlock-migrations.cjs ./scripts/unlock-migrations.cjs

RUN mkdir -p /app/.data/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

# Ap dung migration roi khoi dong Next.js o che do production.
# Toan bo logic nam trong `scripts/docker-start.cjs` (de doc/de sua va tranh loi CRLF cua file .sh):
#   1) Go "advisory lock" con treo tren Neon - nguyen nhan loi P1002 khi deploy;
#   2) `prisma migrate deploy` qua ket noi TRUC TIEP (bo "-pooler"), thu lai toi da 4 lan;
#   3) `next start` + chuyen tiep tin hieu dung (SIGTERM/SIGINT).
CMD ["node", "scripts/docker-start.cjs"]

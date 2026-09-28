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

RUN mkdir -p /app/.data/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

# Ap dung migration roi khoi dong Next.js o che do production.
#
# MIGRATION PHAI DI DUONG TRUC TIEP (khong qua pooler):
#   Neon/PgBouncer khien `pg_advisory_lock` cua Prisma bi treo -> "Error: P1002 ... Timed out
#   trying to acquire a postgres advisory lock" va deploy that bai. Uu tien `DIRECT_URL` (chuoi
#   khong co "-pooler"); neu khong co thi tu bo hau to "-pooler" khoi DATABASE_URL.
#   Ung dung luc chay VAN dung DATABASE_URL (pooled) nhu cu.
#
# `${PORT:-3000}`: dung cong do nen tang cap (Render = 10000), local thi mac dinh 3000.
CMD ["sh", "-c", "set -e; MIGRATE_URL=\"${DIRECT_URL:-$DATABASE_URL}\"; MIGRATE_URL=$(printf '%s' \"$MIGRATE_URL\" | sed 's/-pooler//'); echo '[start] prisma migrate deploy qua ket noi TRUC TIEP (bo -pooler)'; DATABASE_URL=\"$MIGRATE_URL\" npx prisma migrate deploy; exec npx next start -p ${PORT:-3000} -H 0.0.0.0"]

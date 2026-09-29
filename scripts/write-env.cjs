/* eslint-disable */
/**
 * Sinh file .env chuan cho moi truong phat trien: node scripts/write-env.cjs
 * Cho phep truyen gia tri qua bien moi truong:
 *   NEW_DATABASE_URL, NEW_DIRECT_URL, NEW_AUTH_SECRET
 *
 * LUU Y: file nay KHONG chua mat khau that (repo la cong khai). Khi khong duoc truyen
 * NEW_DATABASE_URL, script se GIU LAI DATABASE_URL dang co trong .env (neu co) - nho vay chay
 * `npm run env:write` khong lam mat ket noi CSDL dang dung.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/** Duong dan file .env o goc du an */
const target = path.join(__dirname, "..", ".env");

/**
 * Doc mot bien dang co trong .env.
 *
 * Tra ve null neu chua co file / chua khai bao - nho vay chay lai `npm run env:write` khong lam mat
 * gia tri nguoi dung da dat (DATABASE_URL, DIRECT_URL...).
 */
function existingValue(file, name) {
  try {
    const match = fs
      .readFileSync(file, "utf8")
      .match(new RegExp(`^\\s*${name}\\s*=\\s*"(.*)"\\s*$`, "m"));
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/*
 * Thu tu uu tien:
 *  1. NEW_DATABASE_URL (khi tao moi .env hoac doi mat khau: khong dat mat khau that vao ma nguon).
 *  2. DATABASE_URL dang co trong .env (giu nguyen ket noi dang chay).
 *  3. Gia tri mau - phai sua lai trong .env truoc khi chay.
 */
const databaseUrl =
  process.env.NEW_DATABASE_URL ||
  existingValue(target, "DATABASE_URL") ||
  "postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

/*
 * Chuoi TRUC TIEP (bo "-pooler" khoi host) cho moi lenh `prisma migrate`/`prisma studio`.
 * Bat buoc co khi dung Neon/PgBouncer: migrate qua chuoi pooled se treo `pg_advisory_lock` -> loi P1002.
 * De trong thi Dockerfile + render.yaml tu bo "-pooler" khoi DATABASE_URL (van chay, chi kem tuong minh).
 */
const directUrl = process.env.NEW_DIRECT_URL || existingValue(target, "DIRECT_URL") || "";


const authSecret = process.env.NEW_AUTH_SECRET || crypto.randomBytes(32).toString("hex");

const lines = [
  "# =============================================================================",
  "# MyMusic - Bien moi truong (KHONG commit file nay)",
  "# Sinh tu dong bang: node scripts/write-env.cjs",
  "# =============================================================================",
  "",
  "# --- Database: PostgreSQL (Neon / Render Postgres) ---",
  `DATABASE_URL="${databaseUrl}"`,
  "",
  "# Chuoi TRUC TIEP (bo '-pooler' khoi host) cho `prisma migrate` - tranh loi P1002 (advisory lock).",
  `DIRECT_URL="${directUrl}"`,
  "",
  "# --- Auth.js (NextAuth v5) ---",
  `AUTH_SECRET="${authSecret}"`,
  'AUTH_URL="http://localhost:3000"',
  'AUTH_TRUST_HOST="true"',
  "",
  "# --- Storage cho file upload (local | s3) ---",
  'STORAGE_DRIVER="local"',
  'STORAGE_LOCAL_DIR=".data/uploads"',
  'STORAGE_PUBLIC_PREFIX="/api/files"',
  'UPLOAD_MAX_BYTES="52428800"',
  'S3_ENDPOINT=""',
  'S3_REGION=""',
  'S3_BUCKET=""',
  'S3_ACCESS_KEY_ID=""',
  'S3_SECRET_ACCESS_KEY=""',
  'S3_PUBLIC_BASE_URL=""',
  "",
  "# --- Metadata adapters (tuy chon) ---",
  'YOUTUBE_API_KEY=""',
  'METADATA_TIMEOUT_MS="8000"',
  "",
  "# --- Ung dung ---",
  'NEXT_PUBLIC_APP_NAME="NhacCuaHoiKS"',
  "",
  "# --- Docker compose (tuy chon) ---",
  "# Chi can khi chay PostgreSQL ngay tren may (bo comment service `postgres` trong docker-compose.yml).",
  'POSTGRES_USER="nhac"',
  'POSTGRES_PASSWORD="doi-chuoi-nay-truoc-khi-chay-docker"',
  "",
];

fs.writeFileSync(target, lines.join("\r\n"), "utf8");

console.log(`Da ghi ${lines.length} dong vao ${target}`);
console.log(`DATABASE_URL dai ${databaseUrl.length} ky tu, AUTH_SECRET dai ${authSecret.length} ky tu`);

/* eslint-disable */
/**
 * Sinh file .env chuan cho moi truong phat trien: node scripts/write-env.cjs
 * Cho phep truyen gia tri qua bien moi truong:
 *   NEW_DATABASE_URL, NEW_AUTH_SECRET
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

/** Doc DATABASE_URL hien co trong .env (null neu chua co file / chua khai bao) */
function existingDatabaseUrl(file) {
  try {
    const match = fs.readFileSync(file, "utf8").match(/^\s*DATABASE_URL\s*=\s*"(.*)"\s*$/m);
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
  existingDatabaseUrl(target) ||
  "sqlserver://localhost:1433;database=NhacCuaHoi;schema=dbo;user=YOUR_SQL_USER;password=YOUR_SQL_PASSWORD;encrypt=true;trustServerCertificate=true;connectTimeout=15";


const authSecret = process.env.NEW_AUTH_SECRET || crypto.randomBytes(32).toString("hex");

const lines = [
  "# =============================================================================",
  "# MyMusic - Bien moi truong (KHONG commit file nay)",
  "# Sinh tu dong bang: node scripts/write-env.cjs",
  "# =============================================================================",
  "",
  "# --- Database: Microsoft SQL Server (Prisma) ---",
  `DATABASE_URL="${databaseUrl}"`,
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
  "# BAT BUOC khi chay `docker compose up`: mat khau SA cua SQL Server trong container.",
  'MSSQL_SA_PASSWORD="doi-chuoi-nay-truoc-khi-chay-docker"',
  "",
];

fs.writeFileSync(target, lines.join("\r\n"), "utf8");

console.log(`Da ghi ${lines.length} dong vao ${target}`);
console.log(`DATABASE_URL dai ${databaseUrl.length} ky tu, AUTH_SECRET dai ${authSecret.length} ky tu`);

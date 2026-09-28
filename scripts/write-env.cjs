/* eslint-disable */
/**
 * Sinh file .env chuan cho moi truong phat trien: node scripts/write-env.cjs
 * Cho phep truyen gia tri qua bien moi truong:
 *   NEW_DATABASE_URL, NEW_AUTH_SECRET
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const databaseUrl =
  process.env.NEW_DATABASE_URL ||
  /*
   * KHONG dat mat khau that trong file nay (repo la cong khai).
   * Truyen qua bien moi truong, vi du:
   *   $env:NEW_DATABASE_URL="sqlserver://localhost:1433;database=NhacCuaHoi;user=USER;password=PASS;encrypt=true;trustServerCertificate=true"
   *   npm run env:write
   * hoac de gia tri mau roi sua truc tiep file .env sau khi sinh.
   */
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

const target = path.join(__dirname, "..", ".env");
fs.writeFileSync(target, lines.join("\r\n"), "utf8");

console.log(`Da ghi ${lines.length} dong vao ${target}`);
console.log(`DATABASE_URL dai ${databaseUrl.length} ky tu, AUTH_SECRET dai ${authSecret.length} ky tu`);

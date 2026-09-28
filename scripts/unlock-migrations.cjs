/* eslint-disable @typescript-eslint/no-require-imports -- file .cjs la CommonJS, `require()` la dung cu phap */
/**
 * Gỡ "advisory lock" còn treo của Prisma migrate (`pg_advisory_lock(72707369)`).
 *
 * Vì sao cần: nếu một lần deploy bị Render kill giữa lúc `prisma migrate deploy`, session đó
 * có thể còn giữ lock trên Neon một lúc -> mọi lần migrate sau đều chờ 10 giây rồi báo
 * "Error: P1002 - Timed out trying to acquire a postgres advisory lock" (deploy thất bại).
 *
 * Script này chạy TRƯỚC khi migrate (xem `scripts/docker-start.sh`), luôn thoát với mã 0 để
 * không chặn việc khởi động (kết nối lỗi thì chỉ ghi log rồi bỏ qua).
 */
const path = require("node:path");

try {
  /* .env chỉ có ở máy dev; trong container biến môi trường do Render cấp */
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  /* dotenv không bắt buộc */
}

const { Client } = require("pg");

/** Dùng đúng chuỗi TRỰC TIẾP (bỏ "-pooler") như bước migrate */
function migrateUrl() {
  const raw = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  return raw.replace("-pooler", "");
}

(async () => {
  const url = migrateUrl();
  if (!url) {
    console.log("[unlock] Khong co DATABASE_URL/DIRECT_URL -> bo qua");
    return;
  }

  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 8000,
    statement_timeout: 8000,
  });

  await client.connect();

  const before = await client.query(
    "select count(*)::int as n from pg_locks where locktype = 'advisory'",
  );

  if (before.rows[0].n === 0) {
    console.log("[unlock] Khong co advisory lock nao dang bi giu");
  } else {
    const killed = await client.query(
      "select pg_terminate_backend(pid) as killed, pid from pg_locks where locktype = 'advisory' and granted",
    );
    console.log(
      `[unlock] Da go ${killed.rowCount} advisory lock con treo (pid: ${killed.rows
        .map((row) => row.pid)
        .join(", ")})`,
    );
  }

  await client.end();
})().catch((error) => {
  console.log("[unlock] Bo qua (khong go duoc lock):", error.message);
});

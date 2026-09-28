/* eslint-disable @typescript-eslint/no-require-imports -- file .cjs la CommonJS, `require()` la dung cu phap */
/**
 * Khởi động container production (Dockerfile CMD gọi file này):
 *   1) Gỡ "advisory lock" còn treo trên Neon  -> `scripts/unlock-migrations.cjs`
 *   2) `prisma migrate deploy` qua kết nối TRỰC TIẾP (bỏ "-pooler"), thử lại tối đa 4 lần
 *   3) Chạy `next start` và chuyển tiếp tín hiệu dừng (SIGTERM/SIGINT) cho tiến trình con
 *
 * Vì sao viết bằng Node chứ không phải `.sh`: file `.sh` lỡ lưu kiểu CRLF (Windows) sẽ làm `sh`
 * báo lỗi ngay trong container; dùng Node an toàn hơn và image đã có sẵn `pg` + `npx`.
 *
 * Vì sao migrate phải đi đường TRỰC TIẾP: Neon/PgBouncer làm `pg_advisory_lock` của Prisma treo
 * -> "Error: P1002 ... advisory lock" (deploy thất bại). Ứng dụng lúc chạy VẪN dùng DATABASE_URL
 * (pooled) như cũ - chỉ bước migrate dùng chuỗi trực tiếp.
 */
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 5000;

/** Chuỗi kết nối trực tiếp: ưu tiên DIRECT_URL, nếu thiếu thì bỏ "-pooler" khỏi DATABASE_URL */
function migrateUrl() {
  const raw = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  return raw.replace("-pooler", "");
}

/** Che mật khẩu khi in ra log */
function redact(url) {
  return url.replace(/(:\/\/[^:]*:)[^@]*(@)/, "$1***$2");
}

/** Ngủ đồng bộ (không cần gọi `sleep` của hệ điều hành) */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runMigrations(url) {
  console.log(`[start] migrate deploy qua ket noi TRUC TIEP: ${redact(url)}`);

  /* Gỡ lock còn treo từ lần deploy trước (nếu có) - không chặn nếu lỗi */
  spawnSync(process.execPath, [path.join(__dirname, "unlock-migrations.cjs")], { stdio: "inherit" });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    });

    if (result.status === 0) {
      console.log(`[start] migration OK (lan ${attempt})`);
      return true;
    }

    if (attempt < MAX_ATTEMPTS) {
      console.log(`[start] migrate lan ${attempt} that bai -> thu lai sau ${RETRY_DELAY_MS / 1000}s...`);
      sleepSync(RETRY_DELAY_MS);
    }
  }

  /*
   * KHÔNG làm chết container: migration đã được áp dụng ở máy phát triển trước khi push
   * (`npm run db:deploy`), nên ở đây chỉ là lớp bảo hiểm. Nếu vẫn lỗi, chạy tiếp để web không sập
   * và ghi cảnh báo rõ ràng để kiểm tra sau.
   */
  console.log(`[start] CANH BAO: migrate khong thanh cong sau ${MAX_ATTEMPTS} lan.`);
  console.log("[start] Van khoi dong ung dung (migration da ap dung truoc khi phat hanh).");
  console.log("[start] Kiem tra lai: npm run db:check | prisma migrate status");
  return false;
}

function startServer() {
  const port = process.env.PORT || "3000";
  console.log(`[start] next start -p ${port} -H 0.0.0.0`);

  const child = spawn("npx", ["next", "start", "-p", port, "-H", "0.0.0.0"], { stdio: "inherit" });

  /* Docker gửi SIGTERM khi tắt container -> chuyển tiếp cho Next.js để thoát êm */
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => child.kill(signal));
  }

  child.on("exit", (code, signal) => {
    process.exit(signal ? 1 : (code ?? 0));
  });
}

function main() {
  const url = migrateUrl();

  if (!url) {
    console.log("[start] Khong co DATABASE_URL/DIRECT_URL -> bo qua migrate");
  } else {
    runMigrations(url);
  }

  startServer();
}

main();

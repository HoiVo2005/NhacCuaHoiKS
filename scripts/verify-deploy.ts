/**
 * Kiểm chứng cấu hình PHÁT HÀNH (deploy): npx tsx scripts/verify-deploy.ts
 *
 * Lỗi thật đã gặp trên Render:
 *   "Error: P1002 - Timed out trying to acquire a postgres advisory lock" ở bước
 *   `prisma migrate deploy` khi container khởi động. Nguyên nhân: (a) migrate chạy qua chuỗi
 *   pooled của Neon, (b) hai deploy chạy song song nên tranh lock, (c) container bị kill giữa lúc
 *   migrate để lại lock treo trên Neon. Bộ kiểm này canh những điều đó không bị làm hỏng lại.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const dockerfile = read("Dockerfile");
const startScript = read("scripts/docker-start.cjs");
const unlockScript = read("scripts/unlock-migrations.cjs");
const prismaConfig = read("prisma.config.ts");
const renderYaml = read("render.yaml");
const writeEnvScript = read("scripts/write-env.cjs");
const readme = read("README.md");

check(
  "Dockerfile khoi dong qua `scripts/docker-start.cjs` (khong nhoi shell dai vao CMD)",
  dockerfile.includes('CMD ["node", "scripts/docker-start.cjs"]') &&
    dockerfile.includes("COPY --from=builder /app/scripts/docker-start.cjs ./scripts/docker-start.cjs") &&
    dockerfile.includes(
      "COPY --from=builder /app/scripts/unlock-migrations.cjs ./scripts/unlock-migrations.cjs",
    ),
);

check(
  "Migrate di duong TRUC TIEP: uu tien DIRECT_URL, neu thieu thi bo '-pooler' khoi DATABASE_URL",
  startScript.includes("function migrateUrl()") &&
    startScript.includes('replace("-pooler", "")') &&
    startScript.includes("process.env.DIRECT_URL") &&
    startScript.includes("process.env.DATABASE_URL"),
);

check(
  "Go advisory lock con treo TRUOC khi migrate (nguyen nhan P1002 sau khi container bi kill)",
  startScript.includes("unlock-migrations.cjs") &&
    unlockScript.includes("pg_terminate_backend(pid)") &&
    unlockScript.includes("locktype = 'advisory'") &&
    /* Không được chặn khởi động nếu không gỡ được lock */
    unlockScript.includes("[unlock] Bo qua (khong go duoc lock)"),
);

check(
  "Migrate THU LAI nhieu lan (2 deploy chay song song tranh lock -> khong con that bai)",
  startScript.includes("MAX_ATTEMPTS = 4") && startScript.includes("RETRY_DELAY_MS = 5000"),
);

check(
  "Migrate loi KHONG lam chet container: van chay web + ghi canh bao ro rang",
  startScript.includes("runMigrations(url);") &&
    startScript.includes("startServer();") &&
    startScript.includes("CANH BAO: migrate khong thanh cong"),
);

check(
  "Chuyen tiep tin hieu dung (SIGTERM/SIGINT) cho Next.js de docker tat em",
  startScript.includes('"SIGTERM"') &&
    startScript.includes('"SIGINT"') &&
    startScript.includes("child.kill(signal)"),
);

check(
  "prisma.config.ts uu tien DIRECT_URL cho CLI (migrate/studio) - khong bao gio qua pooler",
  prismaConfig.includes("process.env.DIRECT_URL") &&
    prismaConfig.includes("process.env.DATABASE_URL"),
);

check(
  "render.yaml: buoc build cung migrate qua ket noi truc tiep + khai bao bien DIRECT_URL",
  renderYaml.includes('MIGRATE_URL="${DIRECT_URL:-$DATABASE_URL}"') &&
    renderYaml.includes("sed 's/-pooler//'") &&
    renderYaml.includes("key: DIRECT_URL"),
);

check(
  "Tai lieu (README + `npm run env:write`) noi ro DIRECT_URL va loi P1002",
  writeEnvScript.includes("DIRECT_URL") &&
    writeEnvScript.includes("DATABASE_URL") &&
    readme.includes("DIRECT_URL") &&
    readme.includes("P1002"),
);

check(
  "Health bao ban dang chay (RENDER_GIT_COMMIT) de kiem tra duoc deploy nao dang song",
  read("src/app/api/health/route.ts").includes("RENDER_GIT_COMMIT"),
);

check(
  "Khong con cho nao migrate qua pooler theo kieu cu",
  !dockerfile.includes("prisma migrate deploy && next start") &&
    !renderYaml.includes("&& npx prisma migrate deploy &&"),
);

const failed = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
process.exitCode = failed.length === 0 ? 0 : 1;

import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Tao (hoac cap nhat) tai khoan QUAN TRI tren CSDL dang dung: npm run admin:create
 *
 * Vi sao can: neu khong chay `npm run db:seed` (thu vien trong, chi tu them bai sau) thi CSDL
 * khong co tai khoan nao => khong the dang nhap vao khu quan tri de them bai nhac.
 *
 * Cach dung:
 *   npm run admin:create -- --email hoivd@congty.vn --password "MatKhauManh@2026" --name "Vo Dinh Hoi"
 * hoac dat bien moi truong ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 *
 * Them `--dry-run` de chi kiem tra tham so ma KHONG ghi vao CSDL.
 */

/** Doc tham so dang `--ten gia-tri` hoac `--ten=gia-tri` */
function readArg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    return process.argv[index + 1];
  }

  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

async function main() {
  const email = (readArg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = readArg("password") ?? process.env.ADMIN_PASSWORD ?? "";
  const name = (readArg("name") ?? process.env.ADMIN_NAME ?? "Quản trị viên").trim();
  const dryRun = process.argv.includes("--dry-run");

  const problems: string[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("Email khong hop le (--email)");
  /* Cung quy tac voi `createEmployeeSchema`: mat khau toi thieu 8 ky tu */
  if (password.length < 8) problems.push("Mat khau toi thieu 8 ky tu (--password)");
  if (password.length > 100) problems.push("Mat khau toi da 100 ky tu");
  if (!name) problems.push("Thieu ten hien thi (--name)");

  if (problems.length > 0) {
    console.error("KHONG TAO DUOC TAI KHOAN:");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      '\nVi du: npm run admin:create -- --email hoivd@congty.vn --password "MatKhauManh@2026" --name "Vo Dinh Hoi"',
    );
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log("DRY-RUN (khong ghi CSDL):");
    console.log(`  email: ${email}`);
    console.log(`  name : ${name}`);
    console.log(`  role : ADMIN`);
    console.log(`  mat khau: ${password.length} ky tu (dat yeu cau)`);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl.startsWith("postgres")) {
    console.error(
      "DATABASE_URL khong phai chuoi PostgreSQL. Xem .env.example (chuoi pooled cua Neon).",
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role: "ADMIN", isActive: true },
      create: { email, name, passwordHash, role: "ADMIN", isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });

    const songCount = await prisma.song.count();

    console.log("Da tao/cap nhat tai khoan quan tri:");
    console.log(`  ${user.email} (${user.name}) - vai tro ${user.role}`);
    console.log("Dang nhap xong, vao /admin/music/new de them bai nhac dau tien.");
    if (songCount === 0) {
      console.log("Thu vien dang trong -> trang chu se hien trang thai \"chua co bai nhac\".");
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("TAO TAI KHOAN THAT BAI:", error);
  process.exitCode = 1;
});

/* eslint-disable */
/**
 * Doi ten thuong hieu trong .env (khong tao lai AUTH_SECRET):
 *   node scripts/set-app-name.cjs "NhacCuaHoiKS"
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", ".env");
const name = process.argv[2] || "NhacCuaHoiKS";

if (!fs.existsSync(file)) {
  console.error("Khong tim thay file .env");
  process.exit(1);
}

let text = fs.readFileSync(file, "utf8");

// Cap nhat dong ten ung dung
if (/^NEXT_PUBLIC_APP_NAME=/m.test(text)) {
  text = text.replace(/^NEXT_PUBLIC_APP_NAME=.*$/m, `NEXT_PUBLIC_APP_NAME="${name}"`);
} else {
  text = `${text.trimEnd()}\r\n\r\n# --- Ung dung ---\r\nNEXT_PUBLIC_APP_NAME="${name}"\r\n`;
}

// Cap nhat comment tieu de cho dung thuong hieu
text = text.replace(/^# MyMusic - Bien moi truong.*$/m, `# ${name} - Bien moi truong (KHONG commit file nay)`);

fs.writeFileSync(file, text, "utf8");

console.log("APP_NAME =", name);
console.log(
  text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("NEXT_PUBLIC_APP_NAME"))
    .join(" | "),
);
console.log("AUTH_SECRET_LEN =", (text.match(/AUTH_SECRET="([^"]*)"/) || [])[1]?.length ?? 0);

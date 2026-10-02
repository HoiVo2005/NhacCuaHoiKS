import { getCloudflareContext } from "@opennextjs/cloudflare";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@prisma/client";

/**
 * Lay chuoi ket noi CSDL:
 *  - Tren Cloudflare Workers: uu tien binding Hyperdrive (env.HYPERDRIVE.connectionString).
 *    Hyperdrive lam TCP + connection pooling ho Worker (xem HUONG-DAN-DEPLOY-CLOUDFLARE.md).
 *  - O moi noi khac (Node: Render/Vercel/Docker/script tsx): dung bien moi truong DATABASE_URL.
 *
 * `getCloudflareContext()` se nem loi khi KHONG chay tren Cloudflare -> bat loi roi roi xuong
 * DATABASE_URL, nho vay cung mot file chay duoc ca hai moi truong.
 */
function resolveConnectionString(): string {
  try {
    const { env } = getCloudflareContext();
    const hyperdrive = (env as { HYPERDRIVE?: { connectionString?: string } }).HYPERDRIVE;
    if (hyperdrive?.connectionString) return hyperdrive.connectionString;
  } catch {
    /* Khong phai moi truong Cloudflare. */
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Thieu ket noi CSDL: can binding HYPERDRIVE (Cloudflare) hoac bien DATABASE_URL. Xem HUONG-DAN-DEPLOY-CLOUDFLARE.md.",
    );
  }

  return databaseUrl;
}

let cachedClient: PrismaClient | undefined;

function createPrismaClient(): PrismaClient {
  /*
   * Driver adapter thuan JavaScript (node-postgres) - Prisma 7 khong dung Rust engine nua.
   *
   * `maxUses: 1` la tuy chon BAT BUOC voi Cloudflare Workers: Worker KHONG cho tai su dung
   * connection giua cac request, nen moi connection chi dung DUNG MOT lan roi dong lai.
   * Tren Node tuy chon nay vo hai (chi khien pool mo ket noi moi cho moi truy van).
   *
   * Cac tuy chon khac giu nhu ban cu:
   *  - Dung chuoi co `-pooler`/Hyperdrive de nhieu request dung chung ket noi.
   *  - `idleTimeoutMillis` PHAI ngan (10s): Neon tu "ngu" sau ~5 phut khong dung.
   *  - `max: 5` nam trong han muc ket noi cua goi Neon mien phi.
   */
  const adapter = new PrismaPg({
    connectionString: resolveConnectionString(),
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    maxUses: 1,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Tao client MOT lan (lazy) - chi thuc su tao o lan dung dau tien. */
function getPrismaClient(): PrismaClient {
  cachedClient ??= createPrismaClient();
  return cachedClient;
}

/**
 * Giu nguyen kieu `PrismaClient` va moi cho goi `prisma.xxx` KHONG phai sua.
 *
 * Ben trong la Proxy: client duoc tao LAZY o lan dung dau tien - nho vay
 * `resolveConnectionString()` chay trong ngu canh request (co the doc binding Hyperdrive cua
 * Cloudflare), thay vi luc nap module.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    // Khong de `prisma` thanh "thenable" -> tranh loi
    // "Promise.prototype.then called on incompatible receiver" tren Cloudflare Workers.
    if (property === "then") return undefined;

    const client = getPrismaClient();
    const value = Reflect.get(client, property) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

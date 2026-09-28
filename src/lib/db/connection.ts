import type { config as MssqlConfig } from "mssql";

/**
 * Chuyen DATABASE_URL dang Prisma (sqlserver://host:1433;database=...;user=...;password=...)
 * thanh config cua driver `mssql` (tedious) de dung cho @prisma/adapter-mssql.
 *
 * Ho tro ca dang URL co thong tin dang nhap o authority:
 *   sqlserver://user:password@host:1433;database=db;encrypt=true
 * va dang tham so:
 *   sqlserver://host:1433;database=db;user=sa;password=abc;trustServerCertificate=true
 */
function unbrace(value: string): string {
  // Prisma cho phep bao gia tri dac biet trong dau ngoac nhon: {Pass;Word}
  if (value.startsWith("{") && value.endsWith("}")) {
    return value.slice(1, -1);
  }
  return value;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function parseSqlServerUrl(rawUrl: string): MssqlConfig {
  const url = (rawUrl || "").trim();

  if (!url.startsWith("sqlserver://")) {
    throw new Error(
      "DATABASE_URL khong hop le: phai bat dau bang 'sqlserver://' (vi du: sqlserver://localhost:1433;database=NhacCuaHoi;user=sa;password=abc;encrypt=true)",
    );
  }

  const withoutProtocol = url.slice("sqlserver://".length);
  const segments = withoutProtocol.split(";");
  const authority = segments.shift() ?? "";

  const params = new Map<string, string>();
  for (const segment of segments) {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex > 0) {
      const key = segment.slice(0, separatorIndex).trim().toLowerCase();
      const value = unbrace(segment.slice(separatorIndex + 1).trim());
      params.set(key, value);
    }
  }

  let hostSection = authority;
  let user = params.get("user") ?? params.get("username") ?? params.get("uid");
  let password = params.get("password") ?? params.get("pwd");

  const atIndex = authority.lastIndexOf("@");
  if (atIndex >= 0) {
    const credentials = authority.slice(0, atIndex);
    hostSection = authority.slice(atIndex + 1);
    const colonIndex = credentials.indexOf(":");
    if (colonIndex >= 0) {
      user = unbrace(credentials.slice(0, colonIndex));
      password = unbrace(credentials.slice(colonIndex + 1));
    } else {
      user = unbrace(credentials);
    }
  }

  // Ho tro ca "host:1433" va "host,1433"
  let server = hostSection;
  let port = 1433;
  const portMatch = hostSection.match(/^(.*?)[,:](\d+)$/);
  if (portMatch) {
    server = portMatch[1];
    port = Number(portMatch[2]);
  }

  // Named instance: host\INSTANCE
  let instanceName: string | undefined;
  const instanceIndex = server.indexOf("\\");
  if (instanceIndex >= 0) {
    instanceName = server.slice(instanceIndex + 1);
    server = server.slice(0, instanceIndex);
    port = Number(params.get("port") ?? 1433);
  }

  const database = params.get("database") ?? params.get("initial catalog") ?? "";
  const encrypt = toBool(params.get("encrypt"), true);
  const trustServerCertificate = toBool(params.get("trustservertrustservercertificate"), false) ||
    toBool(params.get("trustservercertificate"), false);
  const connectTimeout = Number(params.get("connecttimeout") ?? 15);

  if (!server) {
    throw new Error("DATABASE_URL khong hop le: thieu ten server.");
  }

  if (!database) {
    throw new Error("DATABASE_URL khong hop le: thieu ten database.");
  }

  return {
    server,
    port,
    database,
    user,
    password,
    options: {
      encrypt,
      trustServerCertificate,
      enableArithAbort: true,
      ...(instanceName ? { instanceName } : {}),
    },
    pool: {
      // Giu san ket noi de request dau tien sau khi ranh roi khong phai dang nhap lai SQL Server
      max: 10,
      min: 2,
      idleTimeoutMillis: 300_000,
    },
    connectionTimeout: connectTimeout * 1000,
    requestTimeout: 30_000,
  };
}

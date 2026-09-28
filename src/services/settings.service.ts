import { prisma } from "@/lib/db/prisma";

export const SETTING_KEYS = {
  siteName: "site_name",
  allowEmployeePlaylists: "allow_employee_playlists",
  maxUploadMb: "max_upload_mb",
  announcement: "announcement",
} as const;

export interface AppSettings {
  siteName: string;
  allowEmployeePlaylists: boolean;
  maxUploadMb: number;
  announcement: string | null;
}

const DEFAULTS: AppSettings = {
  siteName: process.env.NEXT_PUBLIC_APP_NAME || "NhacCuaHoiKS",
  allowEmployeePlaylists: true,
  maxUploadMb: 50,
  announcement: null,
};

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    siteName: map.get(SETTING_KEYS.siteName) || DEFAULTS.siteName,
    allowEmployeePlaylists:
      (map.get(SETTING_KEYS.allowEmployeePlaylists) ?? "true") === "true",
    maxUploadMb: Number(map.get(SETTING_KEYS.maxUploadMb) ?? DEFAULTS.maxUploadMb),
    announcement: map.get(SETTING_KEYS.announcement) ?? null,
  };
}

export async function saveAppSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const entries: { key: string; value: string }[] = [];

  if (input.siteName !== undefined) {
    entries.push({ key: SETTING_KEYS.siteName, value: input.siteName });
  }
  if (input.allowEmployeePlaylists !== undefined) {
    entries.push({
      key: SETTING_KEYS.allowEmployeePlaylists,
      value: String(input.allowEmployeePlaylists),
    });
  }
  if (input.maxUploadMb !== undefined) {
    entries.push({ key: SETTING_KEYS.maxUploadMb, value: String(input.maxUploadMb) });
  }
  if (input.announcement !== undefined) {
    entries.push({ key: SETTING_KEYS.announcement, value: input.announcement ?? "" });
  }

  await Promise.all(
    entries.map((entry) =>
      prisma.appSetting.upsert({
        where: { key: entry.key },
        create: { key: entry.key, value: entry.value },
        update: { value: entry.value },
      }),
    ),
  );

  return getAppSettings();
}

import { createLocalStorage } from "./local";
import { createS3Storage } from "./s3";
import type { StorageProvider } from "./types";

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;

  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  cached = driver === "s3" ? createS3Storage() : createLocalStorage();
  return cached;
}

export function getMaxUploadBytes(): number {
  const parsed = Number(process.env.UPLOAD_MAX_BYTES ?? 52428800);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 52428800;
}

export * from "./types";
export { getLocalStorageRoot, getPublicPrefix, resolveLocalPath } from "./local";

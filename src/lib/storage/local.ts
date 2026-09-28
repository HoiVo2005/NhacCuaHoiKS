import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SaveObjectInput, StorageProvider, StoredObject } from "./types";

export function getLocalStorageRoot(): string {
  const configured = process.env.STORAGE_LOCAL_DIR || ".data/uploads";
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function getPublicPrefix(): string {
  return (process.env.STORAGE_PUBLIC_PREFIX || "/api/files").replace(/\/+$/, "");
}

/** Chuan hoa key va chan truy cap ra ngoai thu muc storage (path traversal) */
export function resolveLocalPath(key: string): string | null {
  if (!key) return null;

  const normalized = path
    .normalize(key)
    .replace(/^([/\\])+/, "")
    .replace(/\\/g, "/");

  if (normalized.includes("..") || normalized.startsWith("/")) return null;

  const root = getLocalStorageRoot();
  const fullPath = path.resolve(root, normalized);
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!fullPath.startsWith(rootWithSeparator)) return null;

  return fullPath;
}

class LocalStorageProvider implements StorageProvider {
  readonly driver = "local" as const;

  publicUrl(key: string): string {
    return `${getPublicPrefix()}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async save({ key, body }: SaveObjectInput): Promise<StoredObject> {
    const fullPath = resolveLocalPath(key);
    if (!fullPath) {
      throw new Error("Đường dẫn lưu file không hợp lệ.");
    }

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, body);

    return {
      key,
      url: this.publicUrl(key),
      size: body.byteLength,
    };
  }

  async remove(key: string): Promise<void> {
    const fullPath = resolveLocalPath(key);
    if (!fullPath) return;

    try {
      await unlink(fullPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
  }
}

export function createLocalStorage(): StorageProvider {
  return new LocalStorageProvider();
}

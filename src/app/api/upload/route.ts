import { randomUUID } from "node:crypto";
import path from "node:path";

import type { NextRequest } from "next/server";

import { badRequest, handleApi, created, tooManyRequests } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { UPLOAD_ACCEPTED_TYPES } from "@/lib/constants";
import { getMaxUploadBytes, getStorage } from "@/lib/storage";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(-80) || "file";
}

/**
 * POST /api/upload - tai file nhac / anh len storage noi bo.
 * Chi quan tri vien. Tra ve thong tin file da luu (khong tao bai nhac).
 */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const limit = rateLimit(`upload:${guard.user.id}`, 20, 60_000);
  if (!limit.ok) {
    return tooManyRequests(
      `Bạn đã tải lên quá nhiều file. Vui lòng thử lại sau ${limit.retryAfterSeconds} giây.`,
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = (formData.get("kind") as string | null) ?? "audio";

  if (!(file instanceof File)) {
    return badRequest("Thiếu file tải lên (trường \"file\").");
  }

  const contentType = file.type || "application/octet-stream";
  const allowedTypes = kind === "image" ? IMAGE_TYPES : UPLOAD_ACCEPTED_TYPES;

  if (!allowedTypes.includes(contentType)) {
    return badRequest(
      `Định dạng "${contentType}" không được hỗ trợ. Chỉ nhận: ${allowedTypes.join(", ")}.`,
    );
  }

  const maxBytes = getMaxUploadBytes();
  if (file.size > maxBytes) {
    return badRequest(
      `File vượt quá giới hạn ${Math.round(maxBytes / 1024 / 1024)} MB (file hiện tại ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    );
  }

  const now = new Date();
  const folder = kind === "image" ? "images" : "songs";
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}-${sanitizeFileName(file.name)}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().save({ key, body: buffer, contentType });

  return created({
    key: stored.key,
    url: stored.url,
    size: stored.size,
    contentType,
    fileName: file.name,
    kind,
  });
});

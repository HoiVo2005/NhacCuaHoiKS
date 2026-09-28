import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import type { NextRequest } from "next/server";

import { forbidden, notFound } from "@/lib/api/response";
import { getStorage, resolveLocalPath } from "@/lib/storage";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/**
 * Doc header `Range: bytes=...` -> khoang byte can tra ve.
 * Tra ve null khi header khong hop le hoac nam ngoai file (client phai nhan 416).
 *
 * Ho tro ca 3 dang chuan: `bytes=0-1023`, `bytes=1024-` (toi cuoi file), `bytes=-500` (500 byte cuoi).
 */
function parseRange(rangeHeader: string, totalSize: number): { start: number; end: number } | null {
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;

  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, totalSize - suffix), end: totalSize - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Math.min(Number(rawEnd), totalSize - 1) : totalSize - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= totalSize) {
    return null;
  }

  return { start, end };
}

/**
 * Mo luong doc file theo DUNG khoang byte can tra ve.
 *
 * LUU Y (nguyen nhan lam nhac phat cham / giat truoc day): route nay doc CA FILE vao RAM
 * roi moi cat khoang byte (`readFile` + `subarray`). Trinh phat nhac ban nhieu Range request
 * lien tuc (nap truoc khi buffer, khi tua, khi chuyen bai) nen MOI request lai doc lai toan bo
 * file tu dia:
 *  - File vai chuc MB -> moi lan buffer phai cho doc het file: bai nhac "khoi dong cham",
 *    tua bi khung, nhac giat khi mang cham;
 *  - Nhieu nguoi nghe cung luc -> RAM tang vot va nghen dia (moi request giu 1 ban sao file).
 *
 * Nay chi doc dung phan can thiet va tra ve dang STREAM: bo nho gan nhu khong doi theo kich thuoc
 * file va byte dau tien den trinh duyet ngay lap tuc.
 */
function streamOf(filePath: string, start: number, end: number): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream<Uint8Array>;
}


/**
 * GET /api/files/* - phuc vu file nhac/anh trong storage noi bo.
 * Ho tro HTTP Range de tua nhac (seek) muot.
 * Cho phep ca khach chua dang nhap (can thiet de nghe nhac cong khai).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");

  if (getStorage().driver === "s3") {
    // Voi S3/MinIO: chuyen huong toi URL cong khai cua bucket
    return Response.redirect(getStorage().publicUrl(key), 302);
  }

  const filePath = resolveLocalPath(key);
  if (!filePath) return forbidden("Đường dẫn file không hợp lệ.");

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return notFound("File không tồn tại.");
  }

  if (!fileStat.isFile()) return notFound("File không tồn tại.");

  const contentType =
    MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const totalSize = fileStat.size;

  /*
   * ETag theo (kich thuoc + thoi diem sua) -> trinh duyet kiem tra lai bang `If-None-Match`
   * va nhan 304, khong phai tai lai file khi bai nhac khong doi.
   */
  const etag = `W/"${totalSize.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`;

  const baseHeaders: Record<string, string> = {
    "content-type": contentType,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
    etag,
    "last-modified": fileStat.mtime.toUTCString(),
  };

  const ifNoneMatch = request.headers.get("if-none-match");
  if (
    ifNoneMatch &&
    ifNoneMatch.split(",").some((value) => {
      const candidate = value.trim();
      return candidate === etag || candidate === "*";
    })
  ) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, totalSize) : null;

  if (rangeHeader && !range) {
    // Range sai / nam ngoai file: tra 416 kem tong kich thuoc de client tu xu ly
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, "content-range": `bytes */${totalSize}` },
    });
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : totalSize - 1;

  const headers: Record<string, string> = {
    ...baseHeaders,
    "content-length": String(end - start + 1),
    ...(range ? { "content-range": `bytes ${start}-${end}/${totalSize}` } : {}),
  };

  // HEAD: chi tra header (khong mo luong doc file de khong doc thua)
  if (request.method === "HEAD") {
    return new Response(null, { status: range ? 206 : 200, headers });
  }

  return new Response(streamOf(filePath, start, end), { status: range ? 206 : 200, headers });
}

import type { NextRequest } from "next/server";

import { handleApi, ok, tooManyRequests } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { resolveMetadataFromUrl } from "@/lib/music/adapters";
import { AdapterError } from "@/lib/music/types";
import { metadataResolveSchema } from "@/lib/validations";
import { badRequest } from "@/lib/api/response";

/**
 * POST /api/metadata - lay metadata chinh thuc tu YouTube/SoundCloud/TikTok.
 * Chi quan tri vien duoc su dung (chong lam dung lam proxy).
 */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const limitResult = rateLimit(`metadata:${guard.user.id}`, 30, 60_000);
  if (!limitResult.ok) {
    return tooManyRequests(
      `Bạn đã lấy metadata quá nhiều lần. Vui lòng thử lại sau ${limitResult.retryAfterSeconds} giây.`,
    );
  }

  const payload = await request.json();
  const { url } = metadataResolveSchema.parse(payload);

  try {
    const metadata = await resolveMetadataFromUrl(url);
    return ok(metadata);
  } catch (error) {
    if (error instanceof AdapterError) {
      return badRequest(error.message, { code: error.code });
    }
    throw error;
  }
});

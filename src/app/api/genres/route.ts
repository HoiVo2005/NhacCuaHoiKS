import type { NextRequest } from "next/server";

import { created, handleApi, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { genreSchema } from "@/lib/validations";

import { createGenre, listGenres } from "@/services/genre.service";

/** GET /api/genres - tat ca the loai (khach chua dang nhap cung xem duoc) */
export const GET = handleApi(async () => {
  return ok({ items: await listGenres() });
});

/** POST /api/genres - them the loai (quan tri vien) */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const input = genreSchema.parse(payload);

  return created(await createGenre(input));
});

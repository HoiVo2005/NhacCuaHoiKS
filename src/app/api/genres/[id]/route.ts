import type { NextRequest } from "next/server";

import { handleApi, noContent, notFound, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { genreSchema } from "@/lib/validations";

import { deleteGenre, getGenreById, updateGenre } from "@/services/genre.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/genres/:id */
export const GET = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const genre = await getGenreById(id);

  if (!genre) return notFound("Thể loại không tồn tại.");
  return ok(genre);
});

/** PATCH /api/genres/:id */
export const PATCH = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const payload = await request.json();
  const input = genreSchema.parse(payload);

  return ok(await updateGenre(id, input));
});

/** DELETE /api/genres/:id */
export const DELETE = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  await deleteGenre(id);

  return noContent();
});

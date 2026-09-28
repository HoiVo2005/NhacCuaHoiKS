import { ServiceError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/format";
import { toGenreDTO } from "@/lib/mappers";
import type { GenreInput } from "@/lib/validations";
import type { GenreDTO } from "@/types";

export async function listGenres(): Promise<GenreDTO[]> {
  const rows = await prisma.genre.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { songs: true } } },
  });

  return rows.map((row) => toGenreDTO(row, row._count.songs));
}

export async function getGenreById(id: string): Promise<GenreDTO | null> {
  const row = await prisma.genre.findUnique({
    where: { id },
    include: { _count: { select: { songs: true } } },
  });

  return row ? toGenreDTO(row, row._count.songs) : null;
}

async function ensureUniqueSlug(name: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(name) || `the-loai-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;

  // Tim slug chua bi dung
  for (;;) {
    const existing = await prisma.genre.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });

    if (!existing) return slug;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

export async function createGenre(input: GenreInput): Promise<GenreDTO> {
  const duplicate = await prisma.genre.findUnique({
    where: { name: input.name },
    select: { id: true },
  });

  if (duplicate) {
    throw new ServiceError(`Thể loại "${input.name}" đã tồn tại.`, 409, "DUPLICATE_GENRE");
  }

  const created = await prisma.genre.create({
    data: {
      name: input.name,
      slug: await ensureUniqueSlug(input.name),
      description: input.description ?? null,
      color: input.color ?? null,
    },
  });

  return toGenreDTO(created, 0);
}

export async function updateGenre(id: string, input: GenreInput): Promise<GenreDTO> {
  const current = await prisma.genre.findUnique({ where: { id } });
  if (!current) {
    throw new ServiceError("Thể loại không tồn tại.", 404, "GENRE_NOT_FOUND");
  }

  if (input.name !== current.name) {
    const duplicate = await prisma.genre.findUnique({
      where: { name: input.name },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== id) {
      throw new ServiceError(`Thể loại "${input.name}" đã tồn tại.`, 409, "DUPLICATE_GENRE");
    }
  }

  const updated = await prisma.genre.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.name === current.name ? current.slug : await ensureUniqueSlug(input.name, id),
      description: input.description ?? null,
      color: input.color ?? null,
    },
  });

  return toGenreDTO(updated);
}

export async function deleteGenre(id: string): Promise<void> {
  const inUse = await prisma.song.count({ where: { genreId: id } });
  if (inUse > 0) {
    throw new ServiceError(
      `Không thể xoá: đang có ${inUse} bài nhạc thuộc thể loại này.`,
      409,
      "GENRE_IN_USE",
    );
  }

  await prisma.genre.delete({ where: { id } });
}

export async function listGenresWithCounts(): Promise<
  { id: string; name: string; slug: string; color: string | null; songCount: number }[]
> {
  const rows = await prisma.genre.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { songs: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    songCount: row._count.songs,
  }));
}

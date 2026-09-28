import { z } from "zod";

import { optionalText, optionalUrl, playbackTypeSchema, sourceTypeSchema } from "./index";

export const songListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(120).optional(),
  source: sourceTypeSchema.optional(),
  sort: z.enum(["newest", "oldest", "title", "plays"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  scope: z.enum(["published", "all"]).default("published"),
});

export const createSongSchema = z
  .object({
    title: z.string().trim().min(1, "Vui lòng nhập tên bài nhạc").max(300),
    artist: optionalText(200),
    album: optionalText(200),
    description: optionalText(5000),
    durationSeconds: z.coerce.number().int().min(0).max(24 * 60 * 60).default(0),
    thumbnailUrl: optionalUrl(1000),
    sourceType: sourceTypeSchema,
    sourceId: optionalText(200),
    sourceUrl: optionalUrl(1000),
    streamUrl: optionalUrl(1000),
    embedUrl: optionalUrl(1000),
    playbackType: playbackTypeSchema,
    genreId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value === "" ? null : (value ?? null))),
    tags: z.array(z.string().trim().max(40)).max(20).default([]),
    isPublished: z.boolean().default(true),
    mimeType: optionalText(100),
    fileSizeBytes: z.coerce.number().int().min(0).optional().nullable(),
    storageKey: optionalText(500),
  })
  .refine((data) => data.sourceType !== "UPLOADED" || Boolean(data.streamUrl), {
    message: "Bài nhạc tải lên phải có đường dẫn file phát (streamUrl)",
    path: ["streamUrl"],
  })
  .refine((data) => data.sourceType === "UPLOADED" || Boolean(data.embedUrl), {
    message: "Bài nhạc từ nền tảng ngoài phải có đường dẫn nhúng (embedUrl)",
    path: ["embedUrl"],
  });

export const updateSongSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tên bài nhạc").max(300).optional(),
  artist: optionalText(200),
  album: optionalText(200),
  description: optionalText(5000),
  durationSeconds: z.coerce.number().int().min(0).max(24 * 60 * 60).optional(),
  thumbnailUrl: optionalUrl(1000),
  genreId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : (value ?? null))),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  isPublished: z.boolean().optional(),
});

export type CreateSongInput = z.infer<typeof createSongSchema>;
export type UpdateSongInput = z.infer<typeof updateSongSchema>;
export type SongListQuery = z.infer<typeof songListQuerySchema>;

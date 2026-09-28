import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "EMPLOYEE"]);
export const sourceTypeSchema = z.enum(["YOUTUBE", "SOUNDCLOUD", "TIKTOK", "UPLOADED"]);
export const playbackTypeSchema = z.enum(["EMBED", "DIRECT"]);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : (value ?? null)));

export const optionalUrl = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : (value ?? null)))
    .refine((value) => value === null || /^https?:\/\//i.test(value) || value.startsWith("/"), {
      message: "Đường dẫn không hợp lệ (phải bắt đầu bằng http://, https:// hoặc /)",
    });

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email").email("Email không hợp lệ").max(255),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").max(100),
});

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Tên tối thiểu 2 ký tự").max(200),
  email: z.string().trim().email("Email không hợp lệ").max(255),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(100),
  role: roleSchema.default("EMPLOYEE"),
  avatarUrl: optionalUrl(500),
});

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Tên tối thiểu 2 ký tự").max(200).optional(),
  email: z.string().trim().email("Email không hợp lệ").max(255).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  avatarUrl: optionalUrl(500),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(100),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại").max(100),
  newPassword: z.string().min(8, "Mật khẩu mới tối thiểu 8 ký tự").max(100),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Tên tối thiểu 2 ký tự").max(200).optional(),
  avatarUrl: optionalUrl(500),
});

export const genreSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên thể loại").max(100),
  description: optionalText(500),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Màu phải ở dạng #RRGGBB")
    .optional()
    .nullable(),
});

export const playlistSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên playlist").max(200),
  description: optionalText(1000),
  coverUrl: optionalUrl(1000),
  isPublic: z.boolean().default(false),
  /** Chi quan tri vien duoc dat co playlist noi bo */
  isFeatured: z.boolean().optional(),
});

export const updatePlaylistSchema = playlistSchema.partial();

export const reorderPlaylistSchema = z.object({
  songIds: z.array(z.string().min(1)).max(1000),
});

export const addSongToPlaylistSchema = z.object({
  songId: z.string().min(1, "Thiếu mã bài nhạc"),
});

export const historySchema = z.object({
  songId: z.string().min(1, "Thiếu mã bài nhạc"),
  msPlayed: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000).default(0),
  completed: z.boolean().default(false),
  source: z.string().max(50).optional().nullable(),
});

export const durationSchema = z.object({
  durationSeconds: z.coerce.number().int().min(1).max(24 * 60 * 60),
});

export const metadataResolveSchema = z.object({
  url: z.string().trim().min(1, "Vui lòng nhập đường dẫn").max(1000),
});

/** Lời bài hát do quản trị viên dán vào (lời thường hoặc LRC có mốc `[mm:ss.xx]`) */
export const lyricsSchema = z.object({
  lyrics: z
    .string()
    .trim()
    .min(1, "Vui lòng dán nội dung lời bài hát")
    .max(20_000, "Lời bài hát quá dài (tối đa 20.000 ký tự)"),
});

export const artUrlSchema = z.object({
  url: z.string().trim().max(1000),
});

export const appSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(100).optional(),
  allowEmployeePlaylists: z.boolean().optional(),
  maxUploadMb: z.coerce.number().int().min(1).max(2048).optional(),
  announcement: optionalText(500),
});

/**
 * Thao tác quản lý thiết bị đăng nhập:
 *  - `revoke`        : đăng xuất từ xa một thiết bị
 *  - `revoke-others` : đăng xuất mọi thiết bị khác (giữ thiết bị đang dùng)
 *  - `revoke-all`    : đăng xuất tất cả (kể cả thiết bị đang dùng)
 *  - `block`/`unblock`: chặn / mở chặn đăng nhập của một thiết bị
 *  - `rename`        : đặt tên gợi nhớ cho thiết bị
 */
export const deviceCommandSchema = z
  .object({
    action: z.enum(["revoke", "revoke-others", "revoke-all", "block", "unblock", "rename"]),
    deviceId: z.string().trim().min(1).max(100).optional(),
    label: z.string().trim().max(100).optional().nullable(),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .refine(
    (value) =>
      value.action === "revoke-others" ||
      value.action === "revoke-all" ||
      Boolean(value.deviceId),
    { message: "Thiếu thiết bị cần xử lý", path: ["deviceId"] },
  );

export type DeviceCommandInput = z.infer<typeof deviceCommandSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type GenreInput = z.infer<typeof genreSchema>;
export type PlaylistInput = z.infer<typeof playlistSchema>;

/** Chon nhieu ban ghi de thao tac hang loat (xoa nhanh / an-phat hanh) */
export const bulkIdsSchema = z.object({
  ids: z
    .array(z.string().trim().min(1))
    .min(1, "Vui lòng chọn ít nhất một mục")
    .max(500, "Mỗi lần chỉ xử lý tối đa 500 mục"),
});

export const bulkSongActionSchema = bulkIdsSchema.extend({
  action: z.enum(["delete", "publish", "unpublish"]),
});

export const bulkPlaylistActionSchema = bulkIdsSchema.extend({
  action: z.literal("delete"),
});

export type BulkIdsInput = z.infer<typeof bulkIdsSchema>;
export type BulkSongActionInput = z.infer<typeof bulkSongActionSchema>;

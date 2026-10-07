/**
 * Tông âm thanh (EQ preset) cho file tải lên — hiện có preset mô phỏng chữ ký của loa
 * **JBL PartyBox Ultimate** (trầm sâu "danceable", mid không vẩn đục, treble sáng mà không gắt;
 * 2× loa bass 9 inch, dải 30 Hz–20 kHz — theo các bài đánh giá Trusted Reviews / L&B Tech Reviews).
 *
 * Vì sao tinh trong app thay vì để loa tự chỉnh: khi điện thoại phát qua loa Bluetooth, tín hiệu
 * loa nhận chính là tín hiệu app xử lý — EQ trong app cho đúng tông chữ ký trên MỌI thiết bị phát
 * (ngay cả loa thường), và cũng làm nhạc nghe "đậm chất loa" hơn khi mở qua PartyBox Ultimate.
 *
 * Kỹ thuật: chuỗi BiquadFilterNode CỐ ĐỊNH (EQ_BAND_COUNT nốt) nằm trước GainNode trong đồ thị
 * Web Audio của `AudioEngine` (xem `createAudioGraph`). Mỗi thẻ `<audio>` chỉ tạo được đồ thị MỘT
 * lần nên số nốt phải cố định — đổi preset chỉ ghi lại tham số các nốt. Khi tắt EQ mọi nốt để
 * 0 dB (pass-through) chứ không tháo nốt đã nối.
 *
 * Lưu ý đúng lịch sử lỗi của app:
 * - Chỉ file tải lên qua được Web Audio; nguồn nhúng (YouTube/SoundCloud/TikTok) nằm trong iframe
 *   khác miền nên không xử lý được.
 * - Bật EQ = đồ thị Web Audio được tạo cả khi âm lượng ≤ 100% → trên iOS âm thanh bị hệ thống chặn
 *   khi app ra nền (WebKit bug 198277 — đúng lỗi "nghe nhạc chuyển app khác là mất nhạc" đã sửa).
 *   Android/TWA (file APK) không bị ảnh hưởng. Mặc định `"off"` nên ai không bật EQ thì hành vi
 *   nghe nền giữ nguyên 100% (xem `needsWebAudioGraph` trong `src/lib/volume.ts`).
 */

/**
 * Số nốt EQ cố định trong đồ thị Web Audio.
 *
 * Đồ thị tạo tối đa một lần trên mỗi thẻ `<audio>` và dùng lại cho mọi preset → số nốt phải
 * chốt từ đầu; preset dùng ít nốt hơn thì các nốt còn lại để phẳng (0 dB).
 */
export const EQ_BAND_COUNT = 6;

/** Chỉ dùng 3 loại bộ lọc phù hợp tông nhạc: lowshelf/peaking/highshelf */
export type EqFilterType = Extract<BiquadFilterType, "lowshelf" | "peaking" | "highshelf">;

/** Một dải EQ: loại, tần số tâm, độ lệch dB (âm = giảm), Q (tùy chọn, mặc định 1) */
export interface EqBand {
  type: EqFilterType;
  frequency: number;
  gainDb: number;
  q?: number;
}

export type SoundProfileId = "off" | "jbl-partybox";

export interface SoundProfile {
  id: SoundProfileId;
  /** Nhãn hiển thị trong menu chọn tông */
  label: string;
  /** Mô tả ngắn (hiện ngay dưới nhãn trong menu) */
  description: string;
  /** Các dải EQ (rỗng = không đổi gì) */
  bands: EqBand[];
}

/** Tông mặc định: KHÔNG EQ — giữ nguyên hành vi cũ (không tạo Web Audio khi ≤ 100%) */
export const DEFAULT_SOUND_PROFILE: SoundProfileId = "off";

/** Nốt phẳng: 0 dB tại 1 kHz — pass-through, dùng cho preset "off" và bù nốt thừa */
const FLAT_BAND: EqBand = { type: "peaking", frequency: 1000, gainDb: 0, q: 1 };

export const SOUND_PROFILES: SoundProfile[] = [
  {
    id: "off",
    label: "Gốc (không EQ)",
    description: "Nghe đúng bản gốc — không dùng Web Audio, nhạc nền tốt nhất.",
    bands: [],
  },
  {
    id: "jbl-partybox",
    label: "JBL PartyBox Ultimate",
    description: "Trầm sâu, mid gọn, treble sáng — tông chữ ký loa JBL PartyBox Ultimate.",
    bands: [
      // Trầm sâu như 2 loa bass 9 inch của PartyBox Ultimate (dải loa kéo tới 30 Hz)
      { type: "lowshelf", frequency: 90, gainDb: 5 },
      // Gỡ vẩn đục trung-trầm — mở to thì PartyBox Ultimate bị "muddy" nếu dồn 200–400 Hz
      { type: "peaking", frequency: 260, gainDb: -1.5, q: 1 },
      // Presence: giọng hát gọn, chen qua bass khi mở volume lớn
      { type: "peaking", frequency: 3200, gainDb: 1.5, q: 1.1 },
      // Treble sáng nhưng không gắt (tweeter của loa được khen "không chói")
      { type: "highshelf", frequency: 11000, gainDb: 3 },
    ],
  },
];

const PROFILE_MAP = new Map<SoundProfileId, SoundProfile>(
  SOUND_PROFILES.map((profile) => [profile.id, profile]),
);

/** Giá trị có phải id preset hợp lệ không? (dùng để lọc dữ liệu localStorage hỏng) */
export function isSoundProfileId(value: unknown): value is SoundProfileId {
  return typeof value === "string" && PROFILE_MAP.has(value as SoundProfileId);
}

/** Lấy preset theo id; giá trị hỏng/rỏng quy về "off" (mặc định, không EQ) — nhận cả `unknown` để lọc dữ liệu storage */
export function getSoundProfile(value: unknown): SoundProfile {
  return (isSoundProfileId(value) ? PROFILE_MAP.get(value) : undefined) ?? SOUND_PROFILES[0];
}

/** EQ đang bật không? (id hỏng = không bật) — nhận cả `unknown` để lọc dữ liệu storage */
export function isEqActive(value: unknown): boolean {
  return isSoundProfileId(value) && value !== "off";
}

/**
 * Các dải EQ cần ghi vào chuỗi nốt cho preset `value`, đúng `count` phần tử:
 * preset đầy đủ trước, thiếu thì bù nốt phẳng (0 dB).
 */
export function eqBandsFor(
  value: unknown,
  count = EQ_BAND_COUNT,
): EqBand[] {
  const bands = getSoundProfile(value).bands.slice(0, Math.max(count, 0));
  while (bands.length < count) bands.push(FLAT_BAND);
  return bands;
}

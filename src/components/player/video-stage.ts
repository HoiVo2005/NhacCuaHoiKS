/**
 * "O cho video" (video slot) - cau noi giua trinh phat day du va khung video that.
 *
 * Van de: khung video (iframe YouTube/TikTok, widget SoundCloud) nam o goc trang duoi dang
 * `position: fixed` vi KHONG the doi phan tu cha trong DOM (doi cha se lam iframe tai lai tu dau).
 * Neu de nguyen, khung video dung yen tren man hinh (`top: 10vh`) nen khi nguoi dung cuon, video
 * de len tieu de/nghe si ben duoi -> khong doc duoc thong tin bai nhac.
 *
 * Cach giai: trinh phat day du dat mot "o cho" trong luong trang (khung aspect-video trong suot)
 * va dang ky o cho do o day. Module nay doi vi tri o cho thanh toa do CSS cho khung video, nho vay
 * video cuon len/xuong cung noi dung thay vi dung yen; phan tran ra ngoai vung cuon bi cat bot nen
 * khung video khong bao gio de len header.
 */

/**
 * Kieu CSS ap cho khung video; null = khong bam theo o cho (dung vi tri mac dinh trong CSS)
 */
export type VideoStageStyle = Record<string, string> | null;

/**
 * Cac thuoc tinh CSS do o cho dieu khien (xoa het truoc khi ap gia tri moi)
 *
 * LUU Y (loi da tung gap): Tailwind v4 dich `-translate-x-1/2` thanh thuoc tinh `translate`
 * (`translate: -50% 0`) chu KHONG phai `transform` nhu Tailwind v3. Vi vay phai vo hieu hoa
 * CA HAI thuoc tinh, neu chi dat `transform: none` thi phep dich -50% van con va khung video
 * bi day lech sang trai dung nua chieu rong (khong nam chinh giua o cho).
 */
export const VIDEO_STAGE_PROPERTIES = [
  "top",
  "left",
  "width",
  "height",
  "transform",
  "translate",
  "clip-path",
] as const;

let slotElement: HTMLElement | null = null;
let scrollAreaElement: HTMLElement | null = null;
const listeners = new Set<() => void>();

/**
 * Gia tri CSS da ap cho tung khung video.
 *
 * Moi lan ghi `style` lam trinh duyet tinh lai style/paint, ma su kien cuon ban ra rat nhieu lan
 * moi giay (khung video bam theo o cho) nen phan lon cac lan ghi la LAP LAI y nguyen gia tri cu
 * (vi tri khong doi hoac chi doi <1px). Ghi nho gia tri da ap de bo qua cac lan ghi vo ich ->
 * cuon muot hon, dac biet la khi dang phat nhac.
 */
const appliedStyles = new WeakMap<HTMLElement, Map<string, string>>();

/** O cho video hien tai (null khi trinh phat day du dong lai / video dang an) */
export function videoSlotElement(): HTMLElement | null {
  return slotElement;
}

/**
 * Dang ky o cho video (goi voi null khi trinh phat day du dong lai).
 *
 * `scrollArea` la vung cuon chua o cho - dung de cat bot phan khung video tran ra ngoai.
 */
export function registerVideoSlot(slot: HTMLElement | null, scrollArea: HTMLElement | null = null): void {
  if (slotElement === slot && scrollAreaElement === scrollArea) return;

  slotElement = slot;
  scrollAreaElement = scrollArea;

  for (const listener of listeners) listener();
}

/** Theo doi o cho video duoc them/bo (tra ve ham huy dang ky) */
export function watchVideoSlot(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

/**
 * Cat bot phan tran ra ngoai vung cuon (khong de len header cua trinh phat day du).
 * Tra ve null khi khung video nam gon trong vung cuon.
 */
function clipPathFor(rect: DOMRect): string | null {
  const area = scrollAreaElement?.getBoundingClientRect();
  if (!area) return null;

  const top = Math.max(0, area.top - rect.top);
  const bottom = Math.max(0, rect.bottom - area.bottom);
  if (top === 0 && bottom === 0) return null;

  return `inset(${px(top)} 0px ${px(bottom)} 0px)`;
}

/**
 * Doi vi tri o cho thanh toa do CSS cho khung video.
 *
 * - Chua co o cho (video dang an hoac dang o che do noi) -> null: khung video dung vi tri mac dinh.
 * - O cho khong co kich thuoc (chua bo tri xong) -> null.
 * - Con lai -> toa do/kich thuoc dung bang o cho, nen khi cuon, video di chuyen cung noi dung.
 */
export function videoStageStyle(): VideoStageStyle {
  const slot = slotElement;
  if (!slot || !slot.isConnected) return null;

  const rect = slot.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const style: Record<string, string> = {
    top: px(rect.top),
    left: px(rect.left),
    width: px(rect.width),
    height: px(rect.height),
    /*
     * Khung video mac dinh can giua bang cap class `left-1/2 -translate-x-1/2`; khi bam theo
     * o cho thi `top`/`left` da la moc/hinh hoc that nen phai bo phep dich.
     *
     * Phai bo CA HAI: Tailwind v4 dich `-translate-x-1/2` thanh thuoc tinh `translate`
     * (`translate: -50% 0`), khong phai `transform` -> chi dat `transform: none` la khong du,
     * video se bi day lech sang trai nua chieu rong (loi "video khong nam chinh giua").
     */
    transform: "none",
    translate: "none",
  };

  const clipPath = clipPathFor(rect);
  if (clipPath) style["clip-path"] = clipPath;

  return style;
}

/** Xoa toa do bam theo (tra khung video ve vi tri mac dinh trong CSS) */
export function clearVideoStageStyles(element: HTMLElement): void {
  for (const property of VIDEO_STAGE_PROPERTIES) {
    element.style.removeProperty(property);
  }

  appliedStyles.delete(element);
}

/**
 * Ap vi tri cua o cho video cho khung video (tu xoa khi khong con o cho).
 *
 * Chi ghi nhung thuoc tinh THUC SU doi (xem `appliedStyles`): khi cuon, phan lon khung hinh co
 * cung toa do (lam tron den 0.01px) nen bo qua duoc -> giam so lan trinh duyet tinh lai style.
 */
export function applyVideoStageStyles(element: HTMLElement): void {
  const style = videoStageStyle();

  let applied = appliedStyles.get(element);
  if (!applied) {
    applied = new Map<string, string>();
    appliedStyles.set(element, applied);
  }

  for (const property of VIDEO_STAGE_PROPERTIES) {
    const value = style?.[property];
    const previous = applied.get(property);

    if (value) {
      if (previous === value) continue;
      element.style.setProperty(property, value);
      applied.set(property, value);
      continue;
    }

    if (previous === undefined) continue;
    element.style.removeProperty(property);
    applied.delete(property);
  }
}


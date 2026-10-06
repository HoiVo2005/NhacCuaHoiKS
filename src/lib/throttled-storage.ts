import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * Storage cho `zustand/persist` co TIET CHE ghi xuong `localStorage`.
 *
 * Van de: dang phat thi `progress` doi moi giay nen `persist` goi `setItem` ~1 lan/giay. Neu ghi
 * ngay moi lan thi moi giay phai `JSON.stringify` TOAN BO trang thai da luu (queue + bai hien
 * tai...) roi ghi DONG BO xuong `localStorage` tren main thread -> man hinh dung dung luc cap nhat
 * thanh thoi gian -> nhin nhu "giat" trong khi nhac van phat binh thuong (am thanh chay tren
 * thread rieng). Nghe lau thi chuoi JSON moi giay tao ap luc GC, giat ro hon.
 *
 * Cach xu ly (2 lop):
 *  1. Khong luu truong thay doi moi giay: `progress` da bi go khoi `partialize` cua player store
 *     (tinh nang "nghe tiep tu cho dung" da go - moi bai luon phat tu dau, luu cung vo nghia).
 *  2. Bo qua ghi khi noi dung khong doi (`isSamePersistedValue`): `partialize` tra ve object moi
 *     moi lan goi nhung truong khong doi van giu NGUYEN tham chieu (queue/current chi doi khi
 *     zustand thuc su thay doi) -> so sanh tung truong la du, khong can stringify. Con lai van
 *     ghi co tetch sau `delayMs`, ghi not khi tab bi an/dong (`visibilitychange`, `pagehide`)
 *     nen khong mat trang thai khi tat tab.
 */

/**
 * Hai lan luu tru co cung noi dung khong? So sanh TUNG TRUONG bang `Object.is`.
 *
 * `partialize` tao object moi moi lan goi, nhung truong khong thay doi van LA cai cu
 * (mang `queue`, doi `current` giu tham chieu khi zustand cap nhat bat dien) hoac la so/chuoi
 * khong doi -> so sanh tham chieu re, khong can JSON.stringify (cong viec nang voi queue dai).
 */
function isSamePersistedValue<S>(a: StorageValue<S>, b: StorageValue<S>): boolean {
  if (a.version !== b.version) return false;
  if (Object.is(a.state, b.state)) return true;

  const left = a.state as unknown as Record<string, unknown> | null | undefined;
  const right = b.state as unknown as Record<string, unknown> | null | undefined;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }

  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.is(left[key], right[key]));
}

export function createThrottledPersistStorage<S>(delayMs = 1_000): PersistStorage<S> {
  // Server (SSR) hoac moi truong khong co localStorage (script kiem thu chay trong Node):
  // giu trong bo nho de khong ghi, khong canh bao - trang thai phat chi co y nghia trong trinh duyet.
  if (typeof window === "undefined" || !window.localStorage) {
    let memory: StorageValue<S> | null = null;

    return {
      getItem: () => memory,
      setItem: (_name, value) => {
        memory = value;
      },
      removeItem: () => {
        memory = null;
      },
    };
  }

  const storage = window.localStorage;
  let pending: { name: string; value: StorageValue<S> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Lan luu tru cuoi cung - dung de bo qua ghi khi noi dung khong doi (xem `isSamePersistedValue`) */
  let lastWritten: { name: string; value: StorageValue<S> } | null = null;

  const write = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    if (!pending) return;

    const { name, value } = pending;
    pending = null;

    try {
      storage.setItem(name, JSON.stringify(value));
      lastWritten = { name, value };
    } catch {
      // Het dung luong / che do rieng tu: bo qua (khong lam hong trang thai dang phat).
      // `lastWritten` khong doi -> lan ghi tiep van thu lai khi trang thai thay doi.
    }
  };

  // Tab bi an hoac bi dong: ghi not de lan sau mo lai van con bai nhac dang nghe
  if (typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", write);
    window.addEventListener("visibilitychange", () => {
      if (typeof window.document !== "undefined" && window.document.visibilityState === "hidden") {
        write();
      }
    });
  }

  return {
    getItem: (name) => {
      const raw = storage.getItem(name);
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw) as StorageValue<S>;
        // Dia da chua dung noi dung nay -> lan setItem dau tien khong ghi lai mot lan thua
        lastWritten = { name, value: parsed };
        return parsed;
      } catch {
        return null;
      }
    },

    setItem: (name, value) => {
      /*
       * Noi dung khong doi so voi lan luu cuoi -> khong ghi lai: khong JSON.stringify, khong hen
       * gio. Dang phat thi trang thai da luu (queue, bai hien tai, am luong...) van giu nguyen
       * nen moi tick tien do deu bi bo qua o day - main thread khong bi chan, thanh thoi gian
       * khong giat.
       */
      if (
        lastWritten !== null &&
        lastWritten.name === name &&
        isSamePersistedValue(lastWritten.value, value)
      ) {
        // Trang thai tren dia da dung -> huy ban ghi dang cho (neu co) vi se ghi lai cung noi dung
        if (pending === null || pending.name === name) {
          pending = null;
        }
        return;
      }

      pending = { name, value };

      if (timer !== null) return;
      timer = setTimeout(write, delayMs);
    },

    removeItem: (name) => {
      pending = null;
      lastWritten = null;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      storage.removeItem(name);
    },
  };
}

import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * Storage cho `zustand/persist` co TIET CHE ghi xuong `localStorage`.
 *
 * Van de: trinh phat cap nhat `progress` lien tuc khi dang phat (the <audio> ban `timeupdate`
 * ~4 lan/giay, YouTube/SoundCloud ~1-2 lan/giay). Moi lan nhu vay, `persist` mac dinh lai
 * `JSON.stringify` toan bo trang thai da luu (queue + bai hien tai...) roi ghi DONG BO xuong
 * `localStorage` ngay tren main thread -> khi queue dai hoac may yeu thi thay ro giat.
 *
 * Cach xu ly: giu lai gia tri moi nhat va chi ghi sau khi nguoi dung "ngung thay doi" `delayMs`,
 * dong thoi ghi not khi tab bi an/dong (`visibilitychange`, `pagehide`) nen khong mat trang thai
 * khi tat tab.
 */
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
    } catch {
      // Het dung luong / che do rieng tu: bo qua (khong lam hong trang thai dang phat)
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
        return JSON.parse(raw) as StorageValue<S>;
      } catch {
        return null;
      }
    },

    setItem: (name, value) => {
      pending = { name, value };

      if (timer !== null) return;
      timer = setTimeout(write, delayMs);
    },

    removeItem: (name) => {
      pending = null;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      storage.removeItem(name);
    },
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseListReorderOptions {
  itemCount: number;
  /** Duoc goi khi nguoi dung keo mot muc sang vi tri moi */
  onMove: (from: number, to: number) => void;
  /** Vung cuon de tu dong cuon khi keo toi sat mep */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  autoScrollZone?: number;
  autoScrollStep?: number;
}

/**
 * Sap xep lai danh sach bang keo-tha.
 * Dung Pointer Events nen hoat dong ca tren chuot va man hinh cam ung.
 * Kem ho tro ban phim: mui ten len/xuong, Home (dua len dau).
 */
export function useListReorder({
  itemCount,
  onMove,
  scrollContainerRef,
  autoScrollZone = 56,
  autoScrollStep = 12,
}: UseListReorderOptions) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragRef = useRef({ from: -1, pointerId: -1, y: 0 });
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const setItemRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      itemRefs.current[index] = element;
    },
    [],
  );

  const findIndexAt = useCallback((clientY: number): number => {
    const items = itemRefs.current.filter(Boolean) as HTMLElement[];
    if (items.length === 0) return -1;

    for (let index = 0; index < items.length; index += 1) {
      const rect = items[index].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return index;
    }

    const first = items[0].getBoundingClientRect();
    return clientY < first.top ? 0 : items.length - 1;
  }, []);

  // Vong lap khi keo: tu dong cuon + cap nhat vi tri
  useEffect(() => {
    if (draggingIndex === null) return;

    let frame = 0;

    const tick = () => {
      const container = scrollContainerRef?.current;
      const pointerY = dragRef.current.y;

      if (container) {
        const rect = container.getBoundingClientRect();
        if (pointerY < rect.top + autoScrollZone) {
          container.scrollTop -= autoScrollStep;
        } else if (pointerY > rect.bottom - autoScrollZone) {
          container.scrollTop += autoScrollStep;
        }
      }

      const target = findIndexAt(pointerY);
      const from = dragRef.current.from;

      if (target >= 0 && target !== from) {
        onMove(from, target);
        dragRef.current.from = target;
        setDraggingIndex(target);
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [draggingIndex, findIndexAt, onMove, scrollContainerRef, autoScrollStep, autoScrollZone]);

  const endDrag = useCallback(() => {
    dragRef.current.from = -1;
    dragRef.current.pointerId = -1;
    setDraggingIndex(null);
  }, []);

  /** Gan vao tay cam (handle) cua tung muc */
  const dragHandleProps = (index: number) => ({
    style: { touchAction: "none" as const },
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // mot so trinh duyet cu khong ho tro - van keo duoc nho su kien tren window
      }

      dragRef.current = { from: index, pointerId: event.pointerId, y: event.clientY };
      setDraggingIndex(index);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (draggingIndex === null) return;
      event.preventDefault();
      dragRef.current.y = event.clientY;
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowUp" && index > 0) {
        event.preventDefault();
        onMove(index, index - 1);
      } else if (event.key === "ArrowDown" && index < itemCount - 1) {
        event.preventDefault();
        onMove(index, index + 1);
      } else if (event.key === "Home" && index > 0) {
        event.preventDefault();
        onMove(index, 0);
      } else if (event.key === "End" && index < itemCount - 1) {
        event.preventDefault();
        onMove(index, itemCount - 1);
      }
    },
  });

  return { draggingIndex, setItemRef, dragHandleProps };
}

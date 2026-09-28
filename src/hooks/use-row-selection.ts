"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Quan ly tick chon nhieu dong trong mot danh sach.
 * Dung cho thao tac hang loat: xoa nhanh, an/phat hanh nhieu ban ghi...
 */
export function useRowSelection(allIds: string[]) {
  const [selected, setSelected] = useState<string[]>([]);

  const available = useMemo(() => new Set(allIds), [allIds]);

  // Bo cac id khong con trong danh sach (vd: sau khi xoa hoac doi bo loc)
  const selectedIds = useMemo(
    () => selected.filter((id) => available.has(id)),
    [selected, available],
  );

  const toggle = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((current) => {
      const visible = current.filter((id) => available.has(id));
      return visible.length === allIds.length && allIds.length > 0 ? [] : [...allIds];
    });
  }, [allIds, available]);

  const clear = useCallback(() => setSelected([]), []);

  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  return {
    selectedIds,
    count: selectedIds.length,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    clear,
  };
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Compass, LayoutDashboard, LogIn, Search, Sparkles, X } from "lucide-react";

import { AccountMenu } from "@/components/layout/account-menu";
import { Artwork } from "@/components/ui/artwork";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SOURCE_LABELS } from "@/lib/constants";
import { pageMeta } from "@/lib/nav";
import { registerQuickSearch } from "@/lib/quick-search";
import type { SessionUser, SongDTO } from "@/types";

export function Topbar({ user }: { user: SessionUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SongDTO[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // He dieu hanh de hien thi dung phim tat (khong gay lech hydration)
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /mac|iphone|ipad/i.test(window.navigator.userAgent ?? ""),
    () => false,
  );

  const meta = pageMeta(pathname, user?.role ?? null);
  const PageIcon = meta.icon;
  const isAdminArea = pathname.startsWith("/admin");

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { songs: [] }))
        .then((data: { songs?: SongDTO[] }) => {
          setResults(data.songs ?? []);
          setOpen(true);
        })
        .catch(() => undefined);
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /**
   * Mo o tim kiem nhanh.
   *
   *  - ⌘/Ctrl + K: do he thong phim tat toan cuc xu ly (`src/lib/player-shortcuts.ts`) roi goi
   *    `openQuickSearch()` -> chay vao ham duoc dang ky o day. Nhờ vậy phím tắt này cũng hiện
   *    trong bảng trợ giúp `?` và có kiểm chứng tự động.
   *  - Phím `/`: xử lý ngay tại đây vì chỉ có ý nghĩa khi trang này (có ô tìm kiếm) đang mở.
   */
  useEffect(() => {
    const focusSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
      if (results.length > 0) setOpen(true);
    };

    registerQuickSearch(focusSearch);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;

      event.preventDefault();
      focusSearch();
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      registerQuickSearch(null);
      document.removeEventListener("keydown", handleKey);
    };
  }, [results.length]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) return;
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/music/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <header className="glass sticky top-12 z-20 border-b border-border/70 lg:top-0">
      {/* Vet sang mau chu dao o chan header */}
      <div aria-hidden className="hairline h-px w-full" />
      <div className="mx-auto flex h-12 w-full max-w-screen-2xl items-center gap-1.5 px-3 sm:h-auto sm:gap-3 sm:px-5 sm:py-2.5">
        {/* Tieu de trang hien tai (chi tren desktop) */}
        <div className="hidden min-w-0 shrink-0 items-center gap-2.5 lg:flex lg:w-56 xl:w-72">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
            <PageIcon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">{meta.title}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{meta.hint}</span>
          </span>
        </div>

        {/* Tim kiem nhanh */}
        <div ref={containerRef} className="relative min-w-0 flex-1 lg:max-w-lg xl:max-w-xl">
          <form onSubmit={submitSearch} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/70 sm:left-3.5" />
            <Input
              ref={inputRef}
              value={term}
              onChange={(event) => {
                const value = event.target.value;
                setTerm(value);
                // Xoa ket qua cu khi nguoi dung xoa tu khoa
                if (value.trim().length < 2) {
                  setResults([]);
                  setOpen(false);
                }
              }}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Tìm bài nhạc, nghệ sĩ, thể loại..."
              className="h-9 rounded-full border-border/60 bg-surface/60 pl-9 pr-9 sm:h-10 sm:pl-10 sm:pr-20"
              aria-label="Tìm kiếm"
              autoComplete="off"
            />

            {term ? (
              <button
                type="button"
                onClick={() => {
                  setTerm("");
                  setResults([]);
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                aria-label="Xoá từ khoá"
                className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-hover hover:text-foreground sm:right-2.5"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:flex">
                {isMac ? "⌘" : "Ctrl"} K
              </kbd>
            )}
          </form>

          {open && results.length > 0 ? (
            <div className="animate-fade-in absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-1.5 shadow-float backdrop-blur-xl">
              <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Sparkles className="size-3 text-primary" /> Bài nhạc
              </p>

              {results.map((song) => (
                <Link
                  key={song.id}
                  href={`/music/search?q=${encodeURIComponent(song.title)}`}
                  onClick={() => setOpen(false)}
                  className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-surface-hover"
                >
                  {song.thumbnailUrl ? (
                    <Artwork
                      src={song.thumbnailUrl}
                      alt=""
                      className="art-frame size-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand-sky/10 text-sm text-primary">
                      ♪
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{song.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {song.artist || "Không rõ nghệ sĩ"} · {SOURCE_LABELS[song.sourceType]}
                    </span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              ))}

              <Link
                href={`/music/search?q=${encodeURIComponent(term.trim())}`}
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-xs font-medium text-white shadow-soft transition hover:opacity-95"
              >
                Xem tất cả kết quả <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : null}
        </div>

        {/* Hanh dong ben phai (chi desktop): mobile da co tai khoan, sang tao va doi giao dien o header */}
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <ThemeToggle className="size-8" />

          {user?.role === "ADMIN" ? (
            <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
              <Link href={isAdminArea ? "/music" : "/admin"}>
                {isAdminArea ? (
                  <Compass className="size-4" />
                ) : (
                  <LayoutDashboard className="size-4" />
                )}
                <span className="hidden xl:inline">{isAdminArea ? "Nghe nhạc" : "Quản trị"}</span>
              </Link>
            </Button>
          ) : null}

          {user ? (
            <AccountMenu user={user} />
          ) : (
            <Button asChild size="sm" variant="gradient" className="h-9 shrink-0 rounded-full">
              <Link href="/login">
                <LogIn className="size-4" /> Đăng nhập
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

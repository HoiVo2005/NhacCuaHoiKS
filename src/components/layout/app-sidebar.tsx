"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";

import { BrandLockup, BrandMark } from "@/components/brand/logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { createItemFor, isActiveNav, navSectionsFor } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import type { Role, SessionUser } from "@/types";

export function AppSidebar({
  role,
  userName,
}: {
  role: Role | null;
  userName: string | null;
}) {
  const pathname = usePathname();
  const sections = navSectionsFor(role);
  const isGuest = !userName;

  return (
    <aside className="glass sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/70 lg:flex">
      <div className="relative px-4 py-5">
        {/* Vet sang mau chu dao duoi logo */}
        <div className="hairline absolute inset-x-4 bottom-0 h-px" />
        <BrandLockup
          name={APP_NAME}
          subtitle={role === "ADMIN" ? "Khu quản trị" : "Thư viện nội bộ"}
        />
      </div>

      <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label} className="space-y-1">
            {section.label ? (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {section.label}
              </p>
            ) : null}

            {section.items.map((item) => {
              const active = isActiveNav(item, pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-primary/12 font-medium text-primary"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  {/* Vach chi bao muc dang mo (kieu sidebar cua cac app streaming) */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-brand transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <item.icon
                    className={cn(
                      "size-4 shrink-0 transition",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border/70 px-4 py-3">
        {role === "ADMIN" ? (
          <Link
            href="/music"
            className="mb-2 flex items-center gap-2 rounded-xl border border-border/70 bg-surface/70 px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            <Compass className="size-3.5" /> Mở giao diện nghe nhạc
          </Link>
        ) : null}

        {isGuest ? (
          <Button asChild size="sm" variant="gradient" className="w-full">
            <Link href="/login">Đăng nhập</Link>
          </Button>
        ) : (
          <p className="truncate text-[11px] text-muted-foreground">Xin chào, {userName}</p>
        )}
      </div>
    </aside>
  );
}

/**
 * Menu mobile.
 *
 * Hang tren (header) la nut 3 gach + logo + nut "Sang tao" nhanh + nut doi giao dien
 * + tai khoan (avatar) hoac nut Dang nhap. Ngan keo ben duoi chi con danh sach dieu huong
 * (khach thi them nut dang nhap) - phan tai khoan da chuyen han len header.
 *
 * Nut 3 gach o goc trai de MO/DONG menu (bam lai de dong). Tu dong dong khi chon muc,
 * doi trang, nhan Esc hoac cham vao nen mo.
 */
export function MobileNav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const role = user?.role ?? null;
  const sections = navSectionsFor(role);
  const createItem = createItemFor(role);
  const homeHref = role === "ADMIN" ? "/admin" : "/music";

  // Nhan Esc de dong va khoa cuon nen khi menu dang mo
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      {/* Hang 1: nut 3 gach + logo + sang tao + doi giao dien + tai khoan/dang nhap */}
      <header className="glass fixed inset-x-0 top-0 z-30 border-b border-border/70">
        <div className="flex h-12 items-center gap-1.5 px-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Đóng menu" : "Mở menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className={cn(
              "flex size-10 shrink-0 flex-col items-center justify-center gap-[3px] rounded-xl transition active:scale-95",
              open
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "h-0.5 w-4 rounded-full bg-current transition-transform duration-300",
                open && "translate-y-[5px] rotate-45",
              )}
            />
            <span
              className={cn(
                "h-0.5 w-4 rounded-full bg-current transition-opacity duration-200",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "h-0.5 w-4 rounded-full bg-current transition-transform duration-300",
                open && "-translate-y-[5px] -rotate-45",
              )}
            />
          </button>

          <Link
            href={homeHref}
            onClick={() => setOpen(false)}
            className="flex min-w-0 items-center gap-2 rounded-xl transition active:scale-[0.98]"
          >
            <BrandMark className="size-8 shrink-0 rounded-xl shadow-md" />
            <span className="text-gradient truncate text-sm font-bold">{APP_NAME}</span>
          </Link>
          <div className="flex-1" />

          <NowPlayingBars />

          {/* Sang tao nhanh: ADMIN them bai nhac, nhan vien tao playlist (khach khong co) */}
          {createItem ? (
            <Link
              href={createItem.href}
              onClick={() => setOpen(false)}
              aria-label={`Sáng tạo: ${createItem.label}`}
              title={`Sáng tạo · ${createItem.label}`}
              className="bg-gradient-brand flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-md transition active:scale-95"
            >
              <createItem.icon className="size-4" />
            </Link>
          ) : null}

          <ThemeToggle className="size-9" />

          {user ? (
            <AccountMenu user={user} showName={false} />
          ) : (
            <Button asChild size="sm" variant="gradient" className="h-9 shrink-0 rounded-full px-3 text-xs">
              <Link href="/login" onClick={() => setOpen(false)}>
                Đăng nhập
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Nen mo: cham vao de dong menu */}
      {open ? (
        <button
          type="button"
          aria-label="Đóng menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="animate-fade-in fixed inset-x-0 bottom-0 top-12 z-30 bg-overlay backdrop-blur-sm"
        />
      ) : null}

      {/* Ngan keo menu day du */}
      <div
        id="mobile-menu"
        aria-hidden={!open}
        className={cn(
          "glass fixed inset-x-0 top-12 z-30 origin-top overflow-hidden border-b border-border/70 transition-[max-height,opacity] duration-300 ease-out",
          open ? "max-h-[calc(100dvh-3rem)] opacity-100" : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        <nav className="scrollbar-thin max-h-[calc(100dvh-7rem)] space-y-3 overflow-y-auto p-2">
          {sections.map((section) => (
            <div key={section.label} className="space-y-0.5">
              {section.label ? (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                  {section.label}
                </p>
              ) : null}

              {section.items.map((item) => {
                const active = isActiveNav(item, pathname);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition",
                      active
                        ? "bg-primary/12 text-primary"
                        : "text-foreground active:bg-surface-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg transition",
                        active
                          ? "bg-gradient-brand text-white shadow-sm"
                          : "bg-surface/80 text-muted-foreground",
                      )}
                    >
                      <item.icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {item.hint}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Khach: goi y dang nhap. Tai khoan da dua len header nen khong lap lai o cuoi menu. */}
        {!user ? (
          <div className="border-t border-border/70 px-3 py-2.5">
            <Button asChild variant="gradient" className="w-full">
              <Link href="/login" onClick={() => setOpen(false)}>
                Đăng nhập để lưu nhạc
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Song am dong bao "dang phat nhac" tren header mobile (dung keyframe equalize co san
 * trong globals.css). Chi hien thi khi trinh phat that su dang chay.
 */
function NowPlayingBars() {
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  if (!isPlaying) return null;

  return (
    <span
      role="img"
      aria-label="Đang phát nhạc"
      title="Đang phát nhạc"
      className="mr-1 flex h-4 shrink-0 items-end gap-[3px]"
    >
      {["-0.15s", "-0.45s", "-0.7s"].map((delay) => (
        <span
          key={delay}
          className="bg-gradient-brand animate-equalize w-[3px] rounded-full"
          style={{ animationDelay: delay }}
        />
      ))}
    </span>
  );
}


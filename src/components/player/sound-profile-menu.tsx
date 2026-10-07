"use client";

import { useState } from "react";
import { AudioLines, Check, Music, Speaker } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { getSoundProfile, SOUND_PROFILES, type SoundProfileId } from "@/lib/sound-profiles";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

/**
 * Nhãn ngắn cho chip trong panel âm lượng điện thoại — label đầy đủ của preset
 * ("JBL PartyBox Ultimate") quá dài cho chip ~60px.
 */
const SHORT_LABELS: Record<SoundProfileId, string> = {
  off: "Gốc",
  "jbl-partybox": "JBL",
};

/** Icon cho từng preset (Speaker = loa JBL, Music = bản gốc) */
function ProfileIcon({ profileId, className }: { profileId: SoundProfileId; className?: string }) {
  return profileId === "jbl-partybox" ? (
    <Speaker className={className} />
  ) : (
    <Music className={className} />
  );
}

/**
 * Nút chọn tông âm thanh (EQ preset) trên thanh phát / trình phát đầy đủ.
 *
 * - Chỉ áp dụng cho **file tải lên** (Web Audio); nguồn nhúng (YouTube/SoundCloud/TikTok)
 *   nằm trong iframe khác miền nên không qua được — menu ghi rõ điều này.
 * - Mặc định "Gốc (không EQ)": không tạo đồ thị Web Audio, giữ nguyên 100% hành vi nghe
 *   nền (xem `needsWebAudioGraph` và `sound-profiles.ts`).
 * - Khác với hẹn giờ (panel rộng cho ô nhập): nội dung menu này chỉ 2 mục ngắn nên dùng
 *   luôn `Dropdown` cho cả điện thoại — mở lên trên (`side="top"`), không bị cắt mép đáy.
 */
export function SoundProfileMenu() {
  const soundProfile = usePlayerStore((state) => state.soundProfile);
  const [open, setOpen] = useState(false);

  const activeProfile = getSoundProfile(soundProfile);
  const isEqOn = soundProfile !== "off";

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    /*
     * Menu nay nam CUNG goc duoi ben phai voi panel "Danh sach phat" (xem `sleep-timer-button`):
     * neu hang cho dang mo ma dung khong dong thi menu bi nam DUOI panel do (z-50 < z-[60])
     * -> nhin nhu nut khong hoat dong. Dong hang cho truoc khi mo.
     */
    if (next && usePlayerStore.getState().queueOpen) {
      usePlayerStore.getState().toggleQueue();
    }
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("size-9 sm:size-8", isEqOn && "text-primary")}
      title={
        isEqOn
          ? `Tông âm thanh: ${activeProfile.label} — bấm để đổi`
          : "Tông âm thanh (EQ) — đang nghe bản gốc"
      }
      aria-label="Tông âm thanh (EQ)"
      aria-expanded={open}
    >
      <AudioLines />
    </Button>
  );

  const panel = (
    <>
      <DropdownLabel>Tông âm thanh · chỉ file tải lên</DropdownLabel>

      {SOUND_PROFILES.map((profile) => {
        const isActive = soundProfile === profile.id;

        return (
          <DropdownItem
            key={profile.id}
            onSelect={() => usePlayerStore.getState().setSoundProfile(profile.id)}
          >
            <ProfileIcon profileId={profile.id} className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm", isActive && "font-semibold text-primary")}>
                {profile.label}
              </span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                {profile.description}
              </span>
            </span>
            {isActive ? <Check className="size-4 shrink-0 text-primary" /> : null}
          </DropdownItem>
        );
      })}

      <p className="px-3 py-2 text-[10px] leading-snug text-muted-foreground">
        Nguồn nhúng không qua Web Audio nên không áp dụng EQ. Bật EQ trên iPhone có thể mất nhạc nền
        khi ra nền (Android/APK phát bình thường) — app sẽ báo một lần khi bạn bật.
      </p>
    </>
  );

  return (
    <Dropdown
      side="top"
      className="z-[60] max-h-[70vh] min-w-64"
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
    >
      {panel}
    </Dropdown>
  );
}

/**
 * Chip tông nhạc cho panel âm lượng điện thoại — chọn nhanh 2 mức ngay trong panel
 * đang mở (giữ panel bằng `data-dropdown-keep-open` để thử qua lại không mất panel).
 */
export function SoundProfileChips() {
  const soundProfile = usePlayerStore((state) => state.soundProfile);

  return (
    <div data-dropdown-keep-open className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Tông
      </span>
      {SOUND_PROFILES.map((profile) => (
        <Button
          key={profile.id}
          type="button"
          size="sm"
          variant={soundProfile === profile.id ? "default" : "secondary"}
          data-dropdown-keep-open
          className="h-7 flex-1 justify-center gap-1 px-2 text-xs"
          title={profile.description}
          onClick={() => usePlayerStore.getState().setSoundProfile(profile.id)}
        >
          <ProfileIcon profileId={profile.id} className="size-3.5" />
          {SHORT_LABELS[profile.id]}
        </Button>
      ))}
    </div>
  );
}

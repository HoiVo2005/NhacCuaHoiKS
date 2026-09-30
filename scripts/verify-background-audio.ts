/**
 * Kiem chung "nghe nhac khi chuyen sang tab / ung dung khac" (ra nen):
 *   npx tsx scripts/verify-background-audio.ts
 *
 * Khoa lai ba loi da gap tren dien thoai (xem `src/lib/background-playback.ts`):
 *  1. Dang nghe ma mo ung dung khac -> su kien `pause` cua he thong bi hieu la "nguoi dung bam tam
 *     dung", nen quay lai app la nhac nam im.
 *  2. Loai phien am thanh chi duoc dat MOT lan luc mo app -> sau khi trang bi an, trinh duyet co the da
 *     tu xoa thiet lap, va iOS chan Web Audio nhu am thanh nen.
 *  3. Quay lai tien canh khong ai phat lai giup (trinh duyet tu tam dung khi o nen nhung KHONG tu phat
 *     lai), ke ca khi co cuoc goi den lam ngat quang.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  applyBackgroundAudioSession,
  isAudioSessionInterrupted,
  reapplyBackgroundAudioSession,
  watchAudioSessionState,
  type AudioSessionState,
  type AudioSessionType,
} from "@/lib/audio-session";
import {
  INTERRUPTION_PAUSE_GRACE_MS,
  isSystemPause,
  RESUME_RETRY_DELAY_MS,
  shouldResumePlayback,
  shouldRetryResumePlayback,
} from "@/lib/background-playback";
import { needsWebAudioGraph } from "@/lib/volume";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

/* ------------------- 1. Su kien pause cua he thong hay cua nguoi dung ------------------- */

/** Trang dang o tien canh va da o do tu lau */
const foreground = { documentHidden: false, msSinceVisible: 60_000 };

check("Thoi gian an han cua su kien pause den muon la 1 giay", INTERRUPTION_PAUSE_GRACE_MS === 1_000);
check(
  "Binh thuong (o tien canh, khong chuyen bai): pause la cua NGUOI DUNG",
  !isSystemPause({ switching: false, ...foreground }),
);
check("Dang chuyen bai: pause la cua he thong", isSystemPause({ switching: true, ...foreground }));
check(
  "Trang dang o NEN: pause la cua he thong (nguoi dung khong the bam gi tren trang)",
  isSystemPause({ switching: false, documentHidden: true, msSinceVisible: 60_000 }),
);
check(
  "Vua quay lai tien canh: su kien pause den muon van la cua he thong",
  isSystemPause({ switching: false, documentHidden: false, msSinceVisible: 200 }),
);
check(
  "Dung moc an han: khong con tinh la cua he thong",
  !isSystemPause({
    switching: false,
    documentHidden: false,
    msSinceVisible: INTERRUPTION_PAUSE_GRACE_MS,
  }),
);
check(
  "Khong tinh duoc khoang thoi gian (NaN) -> coi nhu pause cua nguoi dung",
  !isSystemPause({ switching: false, documentHidden: false, msSinceVisible: Number.NaN }),
);

/* ------------------------------ 2. Khi nao tu phat tiep ------------------------------ */

const canResume = { wantsPlaying: true, documentHidden: false, audioSessionInterrupted: false };

check("Van dang nghe + da o tien canh -> phat tiep", shouldResumePlayback(canResume));
check(
  "Nguoi dung da bam tam dung -> KHONG phat tiep",
  !shouldResumePlayback({ ...canResume, wantsPlaying: false }),
);
check(
  "Trang con o nen -> KHONG phat tiep (trinh duyet chan phat khi trang bi an)",
  !shouldResumePlayback({ ...canResume, documentHidden: true }),
);
check(
  "He thong dang ngat quang (cuoc goi / app khac chiem quyen phat) -> KHONG phat tiep",
  !shouldResumePlayback({ ...canResume, audioSessionInterrupted: true }),
);

/* ------------- 2b. Thu lai MOT lan sau khi quay lai tien canh (lan dau rat de bi bo qua) ------------ */

/** Quay lai tien canh, van muon nghe, nhung dong co bao no CHUA phat */
const notResumed = { ...canResume, actuallyPlaying: false };

check("Cho 1,2 giay roi moi kiem tra lai (khong spam lenh phat)", RESUME_RETRY_DELAY_MS === 1_200);
check("Dong co bao CHUA phat -> goi `play()` lan nua", shouldRetryResumePlayback(notResumed));
check(
  "Dong co bao DANG phat -> khong goi lai (khong lam nhac giat)",
  !shouldRetryResumePlayback({ ...notResumed, actuallyPlaying: true }),
);
check(
  "Nguoi dung da bam tam dung -> khong thu lai",
  !shouldRetryResumePlayback({ ...notResumed, wantsPlaying: false }),
);
check(
  "Trang lai bi an -> khong thu lai",
  !shouldRetryResumePlayback({ ...notResumed, documentHidden: true }),
);
check(
  "He thong con ngat quang -> khong thu lai",
  !shouldRetryResumePlayback({ ...notResumed, audioSessionInterrupted: true }),
);

/* ------------- 2c. Khong de Web Audio giet nhac khi ra nen (nguyen nhan chinh) ------------- */

check(
  "Muc <= 100%: KHONG dung Web Audio (iOS coi Web Audio la am thanh nen -> chan khi ra ngoai)",
  !needsWebAudioGraph(0) && !needsWebAudioGraph(0.8) && !needsWebAudioGraph(1),
);
check("Chi muc > 100% moi dung Web Audio (khuech dai)", needsWebAudioGraph(1.5));

/* --------------------- 3. Phien am thanh phai duoc DAT LAI khi bi xoa --------------------- */

const fakeSession: { type: AudioSessionType } = { type: "auto" };
const navigatorLike = navigator as unknown as { audioSession?: unknown };
const previousAudioSession = navigatorLike.audioSession;

/* Node khong co `navigator.audioSession` -> gan tam doi tuong gia de thu dung duong chay that */
Object.defineProperty(navigatorLike, "audioSession", {
  value: fakeSession,
  configurable: true,
  writable: true,
});

check(
  "Mo app: dat type = playback",
  applyBackgroundAudioSession() && fakeSession.type === "playback",
  fakeSession.type,
);

/*
 * Trinh duyet tu dua `type` ve "auto" khi trang bi an -> ban "nho mot lan" se KHONG dat lai, va iOS lai
 * coi Web Audio la am thanh nen: day chinh la loi "chuyen sang ung dung khac la het nhac".
 *
 * Doi `type` bang ham (khong gan truc tiep) de mo phong dung "trinh duyet doi, khong phai app doi".
 */
function browserResetsSessionType(): void {
  fakeSession.type = "auto";
}

browserResetsSessionType();
check(
  "Ban 'nho mot lan' khong dat lai duoc (nguyen nhan loi cu)",
  applyBackgroundAudioSession() && fakeSession.type === "auto",
  fakeSession.type,
);
check(
  "reapplyBackgroundAudioSession() dat lai type = playback",
  reapplyBackgroundAudioSession() && fakeSession.type === "playback",
  fakeSession.type,
);

if (previousAudioSession === undefined) {
  delete navigatorLike.audioSession;
} else {
  navigatorLike.audioSession = previousAudioSession;
}

/* ------------------------- 4. Trang thai ngat quang cua he thong ------------------------- */

check(
  "Trinh duyet cu (khong co state) -> coi nhu khong bi ngat quang",
  !isAudioSessionInterrupted({ audioSession: { type: "playback" } }),
);
check(
  "state = interrupted -> dang bi ngat quang",
  isAudioSessionInterrupted({
    audioSession: { type: "playback", state: "interrupted" as AudioSessionState },
  }),
);
check(
  "state = active -> khong bi ngat quang",
  !isAudioSessionInterrupted({
    audioSession: { type: "playback", state: "active" as AudioSessionState },
  }),
);

const throwingHost = {
  get audioSession(): { type: AudioSessionType } {
    throw new Error("khong cho doc");
  },
};
check("Doc state nem loi -> khong lam hong trinh phat", !isAudioSessionInterrupted(throwingHost));

/* ------------------------------ 5. Theo doi statechange ------------------------------ */

const events: string[] = [];
const watchableSession = {
  type: "playback" as AudioSessionType,
  addEventListener: (type: string) => events.push(`add:${type}`),
  removeEventListener: (type: string) => events.push(`remove:${type}`),
};

const unwatch = watchAudioSessionState({ audioSession: watchableSession }, () => undefined);
check("Dang ky theo doi statechange", events.join(",") === "add:statechange", events.join(","));

unwatch?.();
check(
  "Huy dang ky duoc khi component unmount (khong ro ri)",
  events.join(",") === "add:statechange,remove:statechange",
  events.join(","),
);
check(
  "Trinh duyet khong ho tro statechange -> tra ve null",
  watchAudioSessionState({ audioSession: { type: "playback" } }, () => undefined) === null,
);

/* ------------------------------- 6. Cac manh ghep UI ------------------------------- */

const engineSource = source("src/components/player/player-engine.tsx");
const audioEngineSource = source("src/components/player/engines/audio-engine.ts");
const youtubeSource = source("src/components/player/engines/youtube-engine.ts");
const readmeSource = source("README.md");

check(
  "Trinh phat dat lai phien am thanh khi trang bi an va khi quay lai",
  engineSource.includes('document.addEventListener("visibilitychange"') &&
    engineSource.includes("reapplyBackgroundAudioSession()"),
);
check(
  "Quay lai tu back/forward cache cung duoc xu ly (pageshow)",
  engineSource.includes('window.addEventListener("pageshow"'),
);
check(
  "Tu phat tiep khi quay lai tien canh (khong de nguoi dung phai bam Phat)",
  engineSource.includes("resumeIfNeeded") && engineSource.includes("shouldResumePlayback({"),
);
check(
  "Su kien pause cua he thong khong bi coi la nguoi dung tam dung",
  engineSource.includes("isSystemPause({") && !engineSource.includes("isUserPause"),
);
check(
  "Theo doi trang thai ngat quang cua he thong (cuoc goi den / ket thuc)",
  engineSource.includes("watchAudioSessionState("),
);
check(
  "File tai len: dat lai phien am thanh TRUOC khi phat",
  audioEngineSource.includes("reapplyBackgroundAudioSession();") &&
    audioEngineSource.indexOf("reapplyBackgroundAudioSession();") <
      audioEngineSource.indexOf("await this.audio.play()"),
);
check(
  "YouTube: hoi thang trinh phat truoc khi bo qua lenh phat tiep (iframe co the da bi tam dung)",
  youtubeSource.includes("playerReportsPlaying()") && youtubeSource.includes("getPlayerState()"),
);
check(
  "Quay lai tien canh: thu lai lan hai khi dong co xac nhan van chua phat",
  engineSource.includes("shouldRetryResumePlayback({") &&
    engineSource.includes("reportsPlaying?.()") &&
    engineSource.includes("RESUME_RETRY_DELAY_MS"),
);
check(
  "The <audio> khong bi dat `display: none` (Chromium coi do la \"khong duoc ve\" -> co the tam dung am thanh)",
  !engineSource.includes('className="hidden"') &&
    engineSource.includes("pointer-events-none fixed bottom-0 left-0 size-[1px] opacity-0"),
);
check(
  "File tai len: KHONG tu dong tao do thi Web Audio cho muc <= 100% (nguyen nhan mat nhac khi ra nen)",
  audioEngineSource.includes("needsWebAudioGraph") && !audioEngineSource.includes("ensureGraph(true)"),
);
check(
  "Do thi Web Audio (chi khi khuech dai) tu danh thuc lai khi bi treo - theo meo trong WebKit bug 281566",
  audioEngineSource.includes("watchGraphResume") &&
    audioEngineSource.includes('addEventListener("statechange"') &&
    audioEngineSource.includes("GRAPH_RESUME_DELAY_MS"),
);
check(
  "iOS: bao cho giao dien biet am luong do he thong quan ly (thay vi am tham chuyen sang Web Audio)",
  audioEngineSource.includes("volumeNeedsSystemControl") &&
    engineSource.includes("engine.volumeNeedsSystemControl"),
);
check(
  "README ghi lai hanh vi + lenh kiem chung",
  readmeSource.includes("check:background") &&
    readmeSource.includes("quay lại tiền cảnh") &&
    readmeSource.includes("Nghe nhạc khi chuyển sang tab") &&
    readmeSource.includes("ambient") &&
    readmeSource.includes("needsWebAudioGraph"),
);

/* --------------------------------- Ket qua --------------------------------- */

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;

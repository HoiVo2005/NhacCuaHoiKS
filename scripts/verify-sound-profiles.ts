import { readFileSync } from "node:fs";
import path from "node:path";

import {
  DEFAULT_SOUND_PROFILE,
  EQ_BAND_COUNT,
  SOUND_PROFILES,
  eqBandsFor,
  getSoundProfile,
  isEqActive,
  isSoundProfileId,
} from "../src/lib/sound-profiles";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

/* ----------------------------- Ham thuan cua preset ----------------------------- */

check("EQ_BAND_COUNT = 6 (so not CO DINH - do thi chi tao 1 lan/the <audio>)", EQ_BAND_COUNT === 6);
check(
  "Mac dinh: OFF (khong EQ) de giuyen hanh vi nghe nen 100%",
  DEFAULT_SOUND_PROFILE === "off" && !isEqActive(DEFAULT_SOUND_PROFILE),
);
check(
  "Dung 2 preset: Goc + JBL PartyBox Ultimate",
  SOUND_PROFILES.length === 2 &&
    SOUND_PROFILES[0].id === "off" &&
    SOUND_PROFILES[1].id === "jbl-partybox",
);

const jbl = getSoundProfile("jbl-partybox");
check("JBL: dung 4 dai EQ (trong 6 not)", jbl.bands.length === 4, String(jbl.bands.length));
check(
  "JBL: tram lowshelf 90 Hz +5 dB (2 loa bass 9 inch)",
  jbl.bands[0]?.type === "lowshelf" && jbl.bands[0]?.frequency === 90 && jbl.bands[0]?.gainDb === 5,
);
check(
  "JBL: giam van dug 260 Hz -1.5 dB (mid khong muddy)",
  jbl.bands[1]?.type === "peaking" &&
    jbl.bands[1]?.frequency === 260 &&
    jbl.bands[1]?.gainDb === -1.5,
);
check(
  "JBL: presence 3.2 kHz +1.5 dB (giu giong hat gon)",
  jbl.bands[2]?.type === "peaking" &&
    jbl.bands[2]?.frequency === 3200 &&
    jbl.bands[2]?.gainDb === 1.5,
);
check(
  "JBL: treble highshelf 11 kHz +3 dB (sang ma khong gat)",
  jbl.bands[3]?.type === "highshelf" &&
    jbl.bands[3]?.frequency === 11000 &&
    jbl.bands[3]?.gainDb === 3,
);

const offBands = eqBandsFor("off");
check(
  "Tat EQ: DAY DU 6 not, moi not 0 dB (pass-through)",
  offBands.length === EQ_BAND_COUNT && offBands.every((band) => band.gainDb === 0),
  offBands.map((band) => band.gainDb).join(","),
);

const jblBands = eqBandsFor("jbl-partybox");
check(
  "JBL: du 6 not - thieu 2 not cuoi duoc BU phang 0 dB",
  jblBands.length === EQ_BAND_COUNT &&
    jblBands[0]?.gainDb === 5 &&
    jblBands[4]?.gainDb === 0 &&
    jblBands[5]?.gainDb === 0,
  jblBands.map((band) => band.gainDb).join(","),
);

check(
  "Gia tri hong tu localStorage: khong phai id hop le, khong bat EQ, quy ve OFF",
  !isSoundProfileId("bogus-eq") &&
    !isEqActive("bogus-eq") &&
    getSoundProfile("bogus-eq").id === "off",
);

/* ------------------------------- Kiem tra nguon ------------------------------- */

const soundProfilesLib = read("src/lib/sound-profiles.ts");
const audioEngine = read("src/components/player/engines/audio-engine.ts");
const engineTypes = read("src/components/player/engines/types.ts");
const store = read("src/store/player-store.ts");
const playerEngine = read("src/components/player/player-engine.tsx");
const menu = read("src/components/player/sound-profile-menu.tsx");
const playerBar = read("src/components/player/player-bar.tsx");
const fullPlayer = read("src/components/player/full-player.tsx");
const pkg = read("package.json");
const readme = read("README.md");

check(
  "Lib: khai bao duong dan ky thuat (6 not, JBL, ham kiem tra gia tri hong)",
  soundProfilesLib.includes("export const EQ_BAND_COUNT = 6") &&
    soundProfilesLib.includes('id: "jbl-partybox"') &&
    soundProfilesLib.includes("export function isSoundProfileId"),
);

check(
  "Do thi: chuoi BiquadFilter nam TRUOC gain (audio -> eq -> gain -> limiter)",
  audioEngine.includes("createBiquadFilter()") &&
    audioEngine.includes("eq -> gain -> limiter") &&
    audioEngine.includes("node.connect(gain)"),
);

check(
  "Do thi: chi tao khi khuech dai > 100% HOAC EQ dang bat (mac dinh off = khong tao)",
  audioEngine.includes("!needsWebAudioGraph(this.volume) && !isEqActive(this.soundProfile)"),
);

check(
  "Engine: setSoundProfile ghi tham so vao tung not (tat = 0 dB)",
  audioEngine.includes("setSoundProfile(profile: SoundProfileId)") &&
    audioEngine.includes("private applySoundProfile()") &&
    audioEngine.includes("node.gain.value = band.gainDb"),
);

check(
  "Dong co (interface): setSoundProfile tuy chon - dong co nhung bo qua",
  engineTypes.includes("setSoundProfile?: (profile: SoundProfileId) => void;"),
);

check(
  "Store: trang thai + action + luu vao localStorage",
  store.includes("soundProfile: SoundProfileId;") &&
    store.includes('| "soundProfile"') &&
    store.includes("soundProfile: state.soundProfile"),
);

check(
  "Store: du lieu hong bi loc khi khoi phuc (merge -> off)",
  store.includes(
    "if (!isSoundProfileId(rest.soundProfile)) rest.soundProfile = DEFAULT_SOUND_PROFILE",
  ),
);

check(
  "PlayerEngine: dong bo soundProfile xuong dong co dang chay",
  playerEngine.includes("engine.setSoundProfile?.(soundProfile)"),
);

check(
  "iOS: canh bao mot lan khi bat EQ (do thi Web Audio bi chan khi ra nen)",
  playerEngine.includes("eqNoticeShownRef") &&
    playerEngine.includes("isEqActive(soundProfile)") &&
    playerEngine.includes("engine.setSoundProfile &&"),
);

check(
  "Menu: ca 2 preset + ghi ro chi ap dung cho file tai len",
  menu.includes("SOUND_PROFILES.map") &&
    menu.includes("setSoundProfile(profile.id)") &&
    menu.includes("chỉ file tải lên"),
);

check(
  "UI: nut tren thanh phat + trinh phat day du + chip trong panel am luong dien thoai",
  playerBar.includes("<SoundProfileMenu />") &&
    playerBar.includes("<SoundProfileChips />") &&
    fullPlayer.includes("<SoundProfileMenu />"),
);

check("Co script check:sound chay chinh script nay", pkg.includes('"check:sound"'));
check("README co tai lieu ve preset JBL PartyBox Ultimate", readme.includes("JBL PartyBox Ultimate"));

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;

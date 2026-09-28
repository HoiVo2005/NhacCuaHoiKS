/**
 * Kiem tra khach (chua dang nhap) van xem trang chu va nghe nhac duoc:
 *   node scripts/guest-access-check.cjs
 * Server can chay truoc (npm run start).
 */
const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@mymusic.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Admin@123456";

const results = [];

function collectCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw.split(";")[0]] : [];
}

function mergeCookies(jar, response) {
  const map = new Map(jar.map((cookie) => [cookie.split("=")[0], cookie]));
  for (const cookie of collectCookies(response)) {
    map.set(cookie.split("=")[0], cookie);
  }
  return [...map.values()];
}

const isRedirect = (response) => [301, 302, 307, 308].includes(response.status);

async function signIn() {
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  let jar = mergeCookies([], csrfResponse);
  const csrf = await csrfResponse.json();

  const loginResponse = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.join("; "),
    },
    body: new URLSearchParams({
      email: EMAIL,
      password: PASSWORD,
      csrfToken: csrf.csrfToken,
      callbackUrl: `${BASE}/`,
    }),
  });

  jar = mergeCookies(jar, loginResponse);
  return jar.join("; ");
}

async function expectStatus(label, path, expected, options = {}) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual", ...options });
  const location = response.headers.get("location") ?? "";
  const passed =
    typeof expected === "function" ? expected(response, location) : response.status === expected;

  results.push(
    `${passed ? "PASS" : "FAIL"} | ${label} | ${path} -> ${response.status}${location ? ` ${location}` : ""} | mong doi: ${typeof expected === "function" ? "tuy chinh" : expected}`,
  );

  return { response, location, passed };
}

async function main() {
  // ---------------------------------------------------------------- Trang HTML
  await expectStatus(
    "Trang goc -> /music cho khach",
    "/",
    (response, location) => isRedirect(response) && location.endsWith("/music"),
  );

  const home = await fetch(`${BASE}/music`);
  const homeHtml = await home.text();
  results.push(
    `${home.status === 200 && homeHtml.includes("Chào mừng bạn đến với") ? "PASS" : "FAIL"} | GET /music -> ${home.status} | loi chao khach: ${homeHtml.includes("Chào mừng bạn đến với")} | co nut dang nhap: ${homeHtml.includes("Đăng nhập")}`,
  );

  for (const path of ["/music/discover", "/music/search?q=nhac", "/login"]) {
    await expectStatus("Trang cong khai cho khach", path, 200);
  }

  // ---------------------------------------------------- Trang ca nhan bi chan
  for (const path of [
    "/music/favorites",
    "/music/history",
    "/music/profile",
    "/music/stats",
    "/music/playlists",
    "/admin",
  ]) {
    await expectStatus(
      "Trang ca nhan chuyen huong ve /login",
      path,
      (response, location) => isRedirect(response) && location.includes("/login"),
    );
  }

  // ------------------------------------------------------------ API doc duoc
  const songsResponse = await fetch(`${BASE}/api/songs?pageSize=2`);
  const songs = await songsResponse.json().catch(() => ({}));
  results.push(
    `${songsResponse.status === 200 && songs.items?.length ? "PASS" : "FAIL"} | GET /api/songs (khach) -> ${songsResponse.status} | total ${songs.total} | items ${songs.items?.length}`,
  );

  await expectStatus("API the loai cho khach", "/api/genres", 200);
  await expectStatus("API tim kiem cho khach", "/api/search?q=nhac", 200);

  const publicPlaylistsResponse = await fetch(`${BASE}/api/playlists`);
  const publicPlaylists = await publicPlaylistsResponse.json().catch(() => ({ items: [] }));
  const onlyPublic = (publicPlaylists.items ?? []).every((item) => item.isPublic === true);
  results.push(
    `${publicPlaylistsResponse.status === 200 && onlyPublic ? "PASS" : "FAIL"} | GET /api/playlists (khach) -> ${publicPlaylistsResponse.status} | ${publicPlaylists.items?.length} playlist | chi gom cong khai: ${onlyPublic}`,
  );

  if (songs.items?.[0]?.id) {
    await expectStatus("Chi tiet bai nhac cho khach", `/api/songs/${songs.items[0].id}`, 200);

    /*
     * "Mix quanh bai nay" chi doc bai da phat hanh nen khach (chua dang nhap) van tao duoc mix -
     * neu quen khai bao trong `isPublicApi` cua proxy thi API tra 401 va nut Mix tren thanh phat
     * cua khach bao loi.
     */
    const mixResponse = await fetch(`${BASE}/api/songs/${songs.items[0].id}/mix?limit=3`);
    const mix = await mixResponse.json().catch(() => ({}));
    results.push(
      `${mixResponse.status === 200 && Array.isArray(mix.songs) ? "PASS" : "FAIL"} | GET /api/songs/:id/mix (khach) -> ${mixResponse.status} | ${mix.songs?.length ?? 0} bai | bai goc dung: ${mix.seed?.id === songs.items[0].id}`,
    );

    /*
     * Loi bai hat: khach duoc DOC (nhu nghe nhac) nhung KHONG duoc dan/sua loi.
     * Loi da cache trong CSDL nen request dau tien co the cham (tra cuu LRCLIB), cac lan sau nhanh.
     */
    const lyricsResponse = await fetch(`${BASE}/api/songs/${songs.items[0].id}/lyrics`);
    const lyrics = await lyricsResponse.json().catch(() => ({}));
    results.push(
      `${lyricsResponse.status === 200 && Array.isArray(lyrics.lines) ? "PASS" : "FAIL"} | GET /api/songs/:id/lyrics (khach) -> ${lyricsResponse.status} | ${lyrics.lines?.length ?? 0} dong | nguon: ${lyrics.source ?? "-"}`,
    );

    const lyricsWrite = await fetch(`${BASE}/api/songs/${songs.items[0].id}/lyrics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lyrics: "Khach khong duoc dan loi" }),
    });
    results.push(
      `${lyricsWrite.status === 401 ? "PASS" : "FAIL"} | POST /api/songs/:id/lyrics (khach) -> ${lyricsWrite.status} | mong doi 401`,
    );
  }

  // -------------------------------------------------------- API bi chan (401)
  for (const path of [
    "/api/favorites",
    "/api/me",
    "/api/admin/stats",
    "/api/history",
    "/api/employees",
  ]) {
    await expectStatus("API ca nhan chan khach", path, 401);
  }

  const firstSongId = songs.items?.[0]?.id;

  const favoriteAttempt = await fetch(`${BASE}/api/songs/${firstSongId}/favorite`, {
    method: "POST",
  });
  results.push(
    `${favoriteAttempt.status === 401 ? "PASS" : "FAIL"} | POST /api/songs/:id/favorite (khach) -> ${favoriteAttempt.status} | mong doi 401`,
  );

  const historyAttempt = await fetch(`${BASE}/api/history`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ songId: firstSongId, msPlayed: 1000 }),
  });
  results.push(
    `${historyAttempt.status === 401 ? "PASS" : "FAIL"} | POST /api/history (khach) -> ${historyAttempt.status} | mong doi 401`,
  );

  const createPlaylistAttempt = await fetch(`${BASE}/api/playlists`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Khach khong duoc tao", isPublic: false }),
  });
  results.push(
    `${createPlaylistAttempt.status === 401 ? "PASS" : "FAIL"} | POST /api/playlists (khach) -> ${createPlaylistAttempt.status} | mong doi 401`,
  );

  // POST duration: khach duoc phep goi (khong phai 401); du lieu sai -> 400
  const durationAttempt = await fetch(`${BASE}/api/songs/${firstSongId}/duration`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ durationSeconds: "khong-phai-so" }),
  });
  results.push(
    `${durationAttempt.status !== 401 ? "PASS" : "FAIL"} | POST /api/songs/:id/duration (khach) -> ${durationAttempt.status} | mong doi khac 401 (400)`,
  );

  // ------------------------------------- Playlist rieng tu cua nguoi khac
  const adminCookie = await signIn();
  const created = await fetch(`${BASE}/api/playlists`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ name: "GUEST_CHECK_PRIVATE", isPublic: false }),
  })
    .then((response) => response.json())
    .catch(() => ({}));

  if (created?.id) {
    const guestDetail = await fetch(`${BASE}/api/playlists/${created.id}`);
    const guestPage = await fetch(`${BASE}/music/playlists/${created.id}`);
    const guestPageHtml = await guestPage.text();
    const listedForGuest = (publicPlaylists.items ?? []).some((item) => item.id === created.id);

    results.push(
      `${guestDetail.status === 403 ? "PASS" : "FAIL"} | GET /api/playlists/:id (playlist rieng tu) -> ${guestDetail.status} | mong doi 403`,
    );
    results.push(
      `${guestPage.status === 200 && guestPageHtml.includes("không có quyền") ? "PASS" : "FAIL"} | Trang playlist rieng tu -> ${guestPage.status} | bao khong co quyen: ${guestPageHtml.includes("không có quyền")}`,
    );
    results.push(
      `${!listedForGuest ? "PASS" : "FAIL"} | Playlist rieng tu khong nam trong danh sach cua khach: ${!listedForGuest}`,
    );

    const cleanup = await fetch(`${BASE}/api/playlists/${created.id}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    results.push(`${cleanup.status === 204 ? "PASS" : "FAIL"} | Don dep playlist kiem tra -> ${cleanup.status}`);
  } else {
    results.push(`FAIL | Khong tao duoc playlist rieng tu de kiem tra: ${JSON.stringify(created)}`);
  }

  // --------------------------------- Nguoi da dang nhap van dung binh thuong
  const adminSongs = await fetch(`${BASE}/api/songs?pageSize=1&scope=all`, {
    headers: { cookie: adminCookie },
  });
  const adminFavorites = await fetch(`${BASE}/api/favorites`, { headers: { cookie: adminCookie } });
  const adminPage = await fetch(`${BASE}/admin`, { headers: { cookie: adminCookie } });
  results.push(
    `${adminSongs.status === 200 && adminFavorites.status === 200 && adminPage.status === 200 ? "PASS" : "FAIL"} | Sau khi dang nhap: /api/songs ${adminSongs.status}, /api/favorites ${adminFavorites.status}, /admin ${adminPage.status}`,
  );

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
}

main().catch((error) => {
  console.error("GUEST CHECK FAILED:", error);
  process.exitCode = 1;
});


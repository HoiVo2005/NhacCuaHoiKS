/* eslint-disable */
/**
 * Smoke test cho server production: node scripts/smoke-test.cjs
 * Kiem tra health, dang nhap, session, API da xac thuc va trang quan tri.
 */
const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@mymusic.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Admin@123456";

function collectCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw.split(";")[0]] : [];
}

function rawSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
}

/**
 * Gop cookie theo trinh duyet: cookie trung ten thi gia tri sau ghi de gia tri truoc.
 */
function mergeCookies(jar, response) {
  const map = new Map(jar.map((cookie) => [cookie.split("=")[0], cookie]));
  for (const cookie of collectCookies(response)) {
    map.set(cookie.split("=")[0], cookie);
  }
  return [...map.values()];
}

async function main() {
  const results = [];

  const healthResponse = await fetch(`${BASE}/api/health`);
  const health = await healthResponse.json();
  results.push(`health | ${healthResponse.status} | ${health.status} | ${health.databaseName ?? "?"} | latency ${health.latencyMs}ms`);

  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  let cookieJar = mergeCookies([], csrfResponse);
  const csrf = await csrfResponse.json();

  const loginBody = new URLSearchParams({
    email: EMAIL,
    password: PASSWORD,
    csrfToken: csrf.csrfToken,
    callbackUrl: `${BASE}/`,
  });

  const loginResponse = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    body: loginBody,
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieJar.join("; "),
    },
  });

  cookieJar = mergeCookies(cookieJar, loginResponse);
  const cookieHeader = cookieJar.join("; ");
  const cookieNames = cookieJar.map((cookie) => cookie.split("=")[0]).join(", ");
  results.push(`login | ${loginResponse.status} | redirect: ${loginResponse.headers.get("location") ?? "-"} | cookies: ${cookieNames}`);

  const session = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookieHeader } }).then((r) => r.json());
  results.push(`session | ${session?.user?.email ?? "none"} | role ${session?.user?.role ?? "-"}`);

  const songsResponse = await fetch(`${BASE}/api/songs?pageSize=3`, { headers: { cookie: cookieHeader } });
  const songs = await songsResponse.json();
  results.push(`songs(auth) | ${songsResponse.status} | total ${songs.total} | items ${songs.items?.length}`);

  const statsResponse = await fetch(`${BASE}/api/admin/stats`, { headers: { cookie: cookieHeader } });
  const stats = await statsResponse.json();
  results.push(`stats(admin) | ${statsResponse.status} | songs ${stats.totalSongs} | plays ${stats.totalPlays} | listeners ${stats.topListeners?.length}`);

  const adminPage = await fetch(`${BASE}/admin`, { headers: { cookie: cookieHeader } });
  const adminHtml = await adminPage.text();
  results.push(`admin page | ${adminPage.status} | co bang dieu khien: ${adminHtml.includes("Tổng quan hệ thống")}`);

  const musicPage = await fetch(`${BASE}/music`, { headers: { cookie: cookieHeader } });
  results.push(`music page | ${musicPage.status}`);

  const unauthSongs = await fetch(`${BASE}/api/songs`);
  results.push(`songs(unauth) | ${unauthSongs.status}`);

  const unauthAdminStats = await fetch(`${BASE}/api/admin/stats`);
  results.push(`stats(unauth) | ${unauthAdminStats.status}`);

  const demoAudio = await fetch(`${BASE}/demo/nhaccuahoiks-demo.wav`, { headers: { cookie: cookieHeader } });
  results.push(`demo audio | ${demoAudio.status} | ${demoAudio.headers.get("content-type")} | ${demoAudio.headers.get("content-length")} bytes`);

  // Kiem tra thuong hieu: logo, manifest, favicon, ten ung dung
  const logoResponse = await fetch(`${BASE}/logo.svg`);
  const manifestResponse = await fetch(`${BASE}/manifest.webmanifest`);
  const manifest = await manifestResponse.json().catch(() => ({}));
  const loginHtml = await fetch(`${BASE}/login`).then((response) => response.text());

  results.push(
    `brand | logo ${logoResponse.status} ${logoResponse.headers.get("content-type")} | manifest ${manifestResponse.status} (${manifest.short_name ?? "?"}) | ten trong HTML: ${loginHtml.includes("NhacCuaHoiKS")} | favicon: ${loginHtml.includes("/logo.svg")}`,
  );

  // Kiem tra lay metadata thuc te tu SoundCloud (link da kiem chung con hoat dong)
  const metadataResponse = await fetch(`${BASE}/api/metadata`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({ url: process.env.SMOKE_SOUNDCLOUD_URL || "https://soundcloud.com/forss/flickermood" }),
  });
  const metadata = await metadataResponse.json().catch(() => ({}));
  results.push(
    `metadata(soundcloud) | ${metadataResponse.status} | ${metadata.title ?? metadata.error} | ${metadata.artist ?? "-"} | ${metadata.durationSeconds ?? "-"}s | ${metadata.provider ?? "-"}`,
  );
  results.push(
    `metadata canh bao | ${(metadata.warnings ?? []).length} muc | co nhac API key: ${String((metadata.warnings ?? []).join(" ")).includes("CLIENT_ID")}`,
  );

  const deadLinkResponse = await fetch(`${BASE}/api/metadata`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({ url: "https://soundcloud.com/odesza/say-my-name-feat-zyra" }),
  });
  const deadLink = await deadLinkResponse.json().catch(() => ({}));
  results.push(`metadata(link chet) | ${deadLinkResponse.status} | ${String(deadLink.error ?? "").slice(0, 80)}`);

  // Kiem tra dong bo thoi luong: trinh phat bao sai lech thi server phai sua lai
  const songsForDuration = await fetch(`${BASE}/api/songs?pageSize=5&scope=all`, {
    headers: { cookie: cookieHeader },
  }).then((response) => response.json());

  const durationSong = (songsForDuration.items ?? []).find((song) => song.durationSeconds > 0);

  if (durationSong) {
    const wrongDuration = durationSong.durationSeconds + 45;

    const syncResponse = await fetch(`${BASE}/api/songs/${durationSong.id}/duration`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ durationSeconds: wrongDuration }),
    });
    const syncResult = await syncResponse.json().catch(() => ({}));

    const afterSync = await fetch(`${BASE}/api/songs/${durationSong.id}`, {
      headers: { cookie: cookieHeader },
    }).then((response) => response.json());

    results.push(
      `duration sync (sua so sai) | POST ${syncResponse.status} | updated=${syncResult.updated} | ${durationSong.durationSeconds}s -> ${afterSync.durationSeconds}s (mong doi ${wrongDuration}s)`,
    );

    // Tra ve gia tri ban dau de du lieu mau khong bi lech
    await fetch(`${BASE}/api/songs/${durationSong.id}/duration`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ durationSeconds: durationSong.durationSeconds }),
    });

    const restored = await fetch(`${BASE}/api/songs/${durationSong.id}`, {
      headers: { cookie: cookieHeader },
    }).then((response) => response.json());

    results.push(
      `duration sync (khoi phuc) | ${restored.durationSeconds}s (mong doi ${durationSong.durationSeconds}s)`,
    );
  } else {
    results.push("duration sync | (khong tim thay bai nhac co thoi luong de kiem tra)");
  }

  // Kiem tra API thao tac hang loat (xoa nhieu playlist + an/phat hanh nhieu bai)
  const createdIds = [];

  for (const name of ["SMOKE_BULK_1", "SMOKE_BULK_2"]) {
    const created = await fetch(`${BASE}/api/playlists`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ name, isPublic: false }),
    })
      .then((response) => response.json())
      .catch(() => ({}));

    if (created?.id) createdIds.push(created.id);
  }

  if (createdIds.length === 2) {
    const bulkResponse = await fetch(`${BASE}/api/playlists/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ action: "delete", ids: createdIds }),
    });
    const bulkResult = await bulkResponse.json().catch(() => ({}));

    const stillThere = await fetch(`${BASE}/api/playlists/${createdIds[0]}`, {
      headers: { cookie: cookieHeader },
    });

    results.push(
      `bulk playlists | POST ${bulkResponse.status} | affected=${bulkResult.affected} | kiem tra lai: ${stillThere.status} (mong doi 404)`,
    );
  } else {
    results.push(`bulk playlists | FAILED: tao duoc ${createdIds.length}/2 playlist kiem tra`);
  }

  const bulkSongTarget = (songsForDuration.items ?? [])[0];

  if (bulkSongTarget) {
    const hideResponse = await fetch(`${BASE}/api/songs/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ action: "unpublish", ids: [bulkSongTarget.id] }),
    });
    const hidden = await fetch(`${BASE}/api/songs/${bulkSongTarget.id}`, {
      headers: { cookie: cookieHeader },
    }).then((response) => response.json());

    const showResponse = await fetch(`${BASE}/api/songs/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ action: "publish", ids: [bulkSongTarget.id] }),
    });
    const restoredSong = await fetch(`${BASE}/api/songs/${bulkSongTarget.id}`, {
      headers: { cookie: cookieHeader },
    }).then((response) => response.json());

    results.push(
      `bulk songs (an/phat hanh) | POST ${hideResponse.status} -> isPublished=${hidden.isPublished} | POST ${showResponse.status} -> isPublished=${restoredSong.isPublished}`,
    );
  }

  const bulkGuardResponse = await fetch(`${BASE}/api/history/bulk`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({ ids: [] }),
  });

  results.push(
    `bulk guard (khong chon gi) | POST /api/history/bulk -> ${bulkGuardResponse.status} (mong doi 422)`,
  );

  // Kiem tra keo-tha sap xep playlist (luu thu tu moi len server)
  const playlistsResponse = await fetch(`${BASE}/api/playlists`, { headers: { cookie: cookieHeader } });
  const playlists = await playlistsResponse.json().catch(() => ({ items: [] }));
  const target = (playlists.items ?? []).find((item) => item.songCount >= 3);

  if (target) {
    const detail = await fetch(`${BASE}/api/playlists/${target.id}`, {
      headers: { cookie: cookieHeader },
    }).then((response) => response.json());
    const originalIds = (detail.songs ?? []).map((song) => song.id);
    const reversedIds = [...originalIds].reverse();

    const putResponse = await fetch(`${BASE}/api/playlists/${target.id}/songs`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ songIds: reversedIds }),
    });

    const afterReorder = await fetch(`${BASE}/api/playlists/${target.id}`, {
      headers: { cookie: cookieHeader },
    }).then((response) => response.json());
    const newIds = (afterReorder.songs ?? []).map((song) => song.id);
    const orderChanged = newIds[0] === reversedIds[0] && newIds.length === originalIds.length;

    // Tra ve thu tu ban dau de du lieu mau khong bi xao tron
    await fetch(`${BASE}/api/playlists/${target.id}/songs`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ songIds: originalIds }),
    });

    results.push(
      `reorder playlist | PUT ${putResponse.status} | ${originalIds.length} bai | dao thu tu thanh cong: ${orderChanged}`,
    );
  } else {
    results.push("reorder playlist | (khong tim thay playlist co >= 3 bai)");
  }

  console.log(results.join("\n"));
}

main().catch((error) => {
  console.error("SMOKE FAILED:", error);
  process.exitCode = 1;
});

/**
 * Do toc do cac trang chinh (chay khi server dang bat):
 *   node scripts/bench.cjs
 */
const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@mymusic.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Admin@123456";

function cookiesOf(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw.split(";")[0]] : [];
}

function merge(jar, response) {
  const map = new Map(jar.map((cookie) => [cookie.split("=")[0], cookie]));
  for (const cookie of cookiesOf(response)) map.set(cookie.split("=")[0], cookie);
  return [...map.values()];
}

async function signIn() {
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  let jar = merge([], csrfResponse);
  const csrf = await csrfResponse.json();

  const loginResponse = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.join("; ") },
    body: new URLSearchParams({
      email: EMAIL,
      password: PASSWORD,
      csrfToken: csrf.csrfToken,
      callbackUrl: `${BASE}/`,
    }),
  });

  jar = merge(jar, loginResponse);
  return jar.join("; ");
}

async function measure(url, cookie, runs = 3) {
  const samples = [];

  for (let index = 0; index < runs; index += 1) {
    const started = Date.now();
    const response = await fetch(`${BASE}${url}`, {
      headers: cookie ? { cookie } : {},
      redirect: "manual",
    });

    // Thoi diem nhan duoc byte dau tien (nguoi dung bat dau thay noi dung)
    const ttfb = Date.now() - started;
    const body = await response.text();
    const total = Date.now() - started;

    samples.push({
      ttfb,
      total,
      status: response.status,
      size: body.length,
      // Trang co khung xuong (skeleton) hien ngay => co streaming
      streamed: body.includes("animate-pulse"),
    });
  }

  const bestOf = (pick) => Math.min(...samples.map(pick));
  const avgOf = (pick) =>
    Math.round(samples.reduce((sum, sample) => sum + pick(sample), 0) / samples.length);

  return {
    ttfbBest: bestOf((sample) => sample.ttfb),
    ttfbAvg: avgOf((sample) => sample.ttfb),
    totalBest: bestOf((sample) => sample.total),
    totalAvg: avgOf((sample) => sample.total),
    status: samples[0].status,
    size: samples[0].size,
    streamed: samples[0].streamed,
  };
}

async function main() {
  const cookie = await signIn();
  const targets = [
    "/",
    "/music",
    "/music/discover",
    "/music/favorites",
    "/admin",
    "/admin/music",
    "/api/songs?pageSize=12",
    "/api/health",
  ];

  const rows = [];

  for (const target of targets) {
    const result = await measure(target, cookie);
    rows.push(
      `${target.padEnd(26)} | ${result.status} | hien noi dung ${String(result.ttfbBest).padStart(4)}ms (tb ${String(result.ttfbAvg).padStart(4)}ms) | xong ${String(result.totalBest).padStart(4)}ms (tb ${String(result.totalAvg).padStart(4)}ms) | ${(result.size / 1024).toFixed(1)} KB${result.streamed ? " | co skeleton" : ""}`,
    );
  }

  console.log(rows.join("\n"));
}

main().catch((error) => {
  console.error("BENCH FAILED:", error);
  process.exitCode = 1;
});

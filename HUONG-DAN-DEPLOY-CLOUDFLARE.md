# Hướng dẫn deploy NhacCuaHoiKS lên Cloudflare Workers

> Áp dụng cho app **Next.js 16 + Prisma 7 + Neon Postgres** (đang chạy Render).
> Cloudflare Workers **miễn phí và KHÔNG cần thẻ**. Database vẫn là **Neon** như cũ.
> Kết nối Neon qua **Hyperdrive** (Cloudflare làm TCP + connection pooling hộ, có cả gói Free).

> ⛔ **KẾT LUẬN SAU KHI THỬ NGHIỆM: Prisma (cả 6.x lẫn 7.x) KHÔNG chạy được trên Cloudflare Workers.**
>
> Đã thử tận cùng trên app này:
> - **Prisma 7.10** → lỗi `Wasm code generation disallowed by embedder` (bug đã biết, chưa sửa:
>   [prisma#28657](https://github.com/prisma/prisma/issues/28657)).
> - **Prisma 6.19.3** (hạ cấp) → lỗi `No such module "node:tty"`; đã bật `nodejs_compat` +
>   `compatibility_date: 2026-03-17` mà **vẫn không qua**.
> - **Prisma 6 + `prisma generate --no-engine`** (đúng công thức Cloudflare) → Prisma **từ chối thẳng**:
>   *"Prisma Client was configured to use the `adapter` option but `prisma generate` was run with `--no-engine`."*
>   ⇒ Prisma 6 **không** có bản dựng vừa chạy trên workerd vừa dùng được driver adapter (Hyperdrive).
>
> 👉 **Hãy dùng Render hoặc Vercel.** Code hiện tại đã ở trạng thái chạy tốt trên Node
> (đã kiểm chứng: build OK, 11 bảng, 2 user). Xem `HUONG-DAN-DEPLOY-VERCEL.md`.
>
> Phần còn lại của tài liệu này giữ làm tham khảo (đã xử lý được middleware, Hyperdrive, symlink Windows...).

> ⚠️ **Đọc trước 2 điều dễ đụng:**
> 1. Gói **Free chỉ cho 10 ms CPU/nhân request** và app có auth + SSR nên **rất dễ vượt** → gặp lỗi
>    `Error 1102 (exceeded CPU time)`. Nếu gặp nhiều, phải nâng **Workers Paid ($5/tháng)**.
> 2. OpenNext **không hỗ trợ Windows tốt**. Nên build/deploy trên **WSL** hoặc **GitHub Actions**.
>    Xem mục 8.

---

## 0. Trạng thái: ĐÃ tạo file + sửa code + cài thư viện ✅

**File mới:**

| File | Vai trò |
| --- | --- |
| `wrangler.jsonc` | Cấu hình Worker: `nodejs_compat`, assets, binding `HYPERDRIVE`, biến `vars` |
| `open-next.config.ts` | Cấu hình OpenNext |
| `.dev.vars` | Biến cho lúc chạy `npm run preview` (đã thêm vào `.gitignore`) |
| `public/_headers` | Cache header cho `/_next/static/*` |
| `scripts/cloudflare-deploy.ps1` | Script `npm run deploy:cf` (cấp chuỗi Hyperdrive local rồi deploy — xem mục 6.2) |
| `.github/workflows/deploy-cloudflare.yml` | Deploy qua GitHub Actions (tránh lỗi Windows) |

**File đã sửa (vẫn chạy tốt trên Render/Vercel):**

| File | Đã đổi gì |
| --- | --- |
| `src/lib/db/prisma.ts` | Đọc Hyperdrive khi ở Cloudflare + fallback `DATABASE_URL`; thêm `maxUses: 1`; client lazy qua `Proxy` |
| `next.config.ts` | `serverExternalPackages` thêm `@prisma/client`, `.prisma/client`; gọi `initOpenNextCloudflareForDev()` khi dev |
| `package.json` | `build` = `prisma generate && next build`; thêm 4 script Cloudflare; thêm `@opennextjs/cloudflare` + `wrangler` |

> ✅ Đã chạy `tsc --noEmit` (0 lỗi) + `npm run build` (thành công). Các thay đổi **không ảnh hưởng** bản Render/Vercel.

---

## 1. Cài dependency ✅ (đã cài sẵn)

Đã cài `@opennextjs/cloudflare@^1.20.7` và `wrangler@^4.145.0`. Nếu sang máy khác thì chạy lại:

```powershell
npm install @opennextjs/cloudflare@latest
npm install --save-dev wrangler@latest
```

Và 4 script đã được thêm vào `package.json` (mục `"scripts"`):

```json
"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"upload": "opennextjs-cloudflare build && opennextjs-cloudflare upload",
"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

---

## 2. Sửa code bắt buộc ✅ (đã sửa sẵn trong repo)

### 2.1. Prisma: an toàn cho Cloudflare (đã áp dụng)

`src/lib/db/prisma.ts` **đã được viết lại** nhưng **giữ nguyên mọi chỗ gọi `prisma.xxx`** (không phải sửa 19 file):

- Đọc binding **`HYPERDRIVE`** khi chạy trên Cloudflare; fallback `DATABASE_URL` khi chạy Node (Render/Vercel/script `tsx`).
- Thêm **`maxUses: 1`** → Worker không tái dùng connection giữa các request (Cloudflare bắt buộc điều này).
- Client tạo **lazy** qua `Proxy` — lần dùng đầu tiên mới tạo, nên đọc được binding Hyperdrive trong ngữ cảnh request.

> ✅ Đã kiểm chứng: `npx tsc --noEmit` → **0 lỗi**; `npm run build` → **thành công** (40 route).

Mã rút gọn phần quan trọng (đầy đủ trong `src/lib/db/prisma.ts`):

```ts
function resolveConnectionString(): string {
  try {
    const { env } = getCloudflareContext();
    const hyperdrive = (env as { HYPERDRIVE?: { connectionString?: string } }).HYPERDRIVE;
    if (hyperdrive?.connectionString) return hyperdrive.connectionString;
  } catch {
    /* không phải Cloudflare -> dùng biến môi trường bên dưới */
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Thiếu HYPERDRIVE hoặc DATABASE_URL");
  return databaseUrl;
}

const adapter = new PrismaPg({
  connectionString: resolveConnectionString(),
  max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000, keepAlive: true,
  maxUses: 1, // Cloudflare: KHÔNG tái dùng connection
});

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
```

> Cách này khác bản "getPrisma() + cache" hay gặp ở tài liệu: nhờ `Proxy`, **các file service không phải sửa**,
> mà vẫn đảm bảo client được tạo đúng ngữ cảnh request trên Workers.

### 2.2. `next.config.ts` (đã áp dụng)

`serverExternalPackages` thêm `@prisma/client`, `.prisma/client` (yêu cầu của OpenNext cho workerd) và gọi
`initOpenNextCloudflareForDev()` khi dev:

```ts
serverExternalPackages: ["@prisma/client", ".prisma/client", "pg", "@prisma/adapter-pg"],
// ...
if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  });
}
```

---

## 3. Tạo Hyperdrive trỏ tới Neon + nạp secrets

> Hyperdrive **có trong cả gói Free** (giới hạn **100.000 truy vấn/ngày**, reset 00:00 UTC).

### 3.1. Đăng nhập Cloudflare

```powershell
npx wrangler login
```

### 3.2. Tạo cấu hình Hyperdrive

⚠️ **Dùng chuỗi Neon TRỰC TIẾP (KHÔNG có `-pooler`)** — vì Hyperdrive đã tự làm pooling.
(Trong Neon Console → Connection Details → **bỏ tick** "Connection pooling" → lấy chuỗi.)

```powershell
npx wrangler hyperdrive create nhaccuahoiks-db --connection-string="postgresql://<user>:<pass>@ep-xxx.<region>.aws.neon.tech/neondb?sslmode=require"
```

Lệnh in ra `id` (dạng chuỗi hex). **Dán id đó** vào `wrangler.jsonc`:
- `"id": "<HYPERDRIVE_ID>"`
- `localConnectionString`: chuỗi Neon ở trên (dùng khi chạy `npm run preview`).

> Nếu báo lỗi SSL khi chạy local, xem mục 7 (`wrangler dev --remote`). Trong production thì
> bình thường — Hyperdrive lo phần SSL nội bộ.

### 3.3. Nạp secrets (biến nhạy cảm)

```powershell
# AUTH_SECRET: sinh 32 byte ngẫu nhiên
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_URL          # = https://nhaccuahoiks.<ten>.workers.dev (điền sau lần deploy đầu)
npx wrangler secret put S3_ENDPOINT
npx wrangler secret put S3_REGION
npx wrangler secret put S3_BUCKET
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler secret put S3_PUBLIC_BASE_URL
```

Các biến **không nhạy cảm** (`NEXT_PUBLIC_APP_NAME`, `STORAGE_DRIVER`, `AUTH_TRUST_HOST`,
`AUTH_USE_SECURE_COOKIES`...) đã khai trong mục `"vars"` của `wrangler.jsonc` — không cần `secret put`.

---

## 4. Migration database (KHÔNG chạy trong Worker)

Cloudflare Workers không có tiến trình dài/ổ đĩa nên **không** chạy `prisma migrate deploy` trong lúc
khởi động như `Dockerfile` cũ. Thay vào đó chạy **một lần từ máy bạn (hoặc CI)** trước khi deploy:

```powershell
# Chuỗi pooled cho app, chuỗi trực tiếp cho migrate
$env:DATABASE_URL="postgresql://...-pooler....neon.tech/neondb?sslmode=require"
$env:DIRECT_URL="postgresql://....neon.tech/neondb?sslmode=require"
npm run db:deploy
```

> App chỉ **đọc/ghi dữ liệu** trong Worker; việc tạo/cập nhật bảng do bạn chạy tay ở bước này.
> `prisma generate` vẫn chạy tự động trong build (xem mục 6).

---

## 5. File upload → R2 (CHỈ khi bạn thật sự cần tải file lên)

> ⚠️ **R2 KHÔNG hoàn toàn "không thẻ":** khi bật R2, Cloudflare yêu cầu **"checkout flow"**
> (thêm phương thức thanh toán), dù bạn dùng trong hạn mức free 10 GB/tháng.
>
> ✅ **Tin tốt:** CSDL hiện tại **không có bài nào kiểu `UPLOADED`** (11 YouTube, 6 SoundCloud, 2 TikTok —
> tất cả là bài nhúng) → **bạn KHÔNG cần R2** để app chạy được. Có thể **bỏ qua cả mục này** →
> deploy hoàn toàn miễn phí, **không cần thẻ**.
>
> Nếu sau này muốn tải file lên mà vẫn không muốn dùng thẻ, dùng một S3-compatible miễn phí không cần thẻ:
> **Supabase Storage** (1 GB free) — điền các biến `S3_*` trỏ tới Supabase thay vì R2.

Workers không có filesystem, nên `STORAGE_DRIVER=local` vô hiệu. Nếu chọn Cloudflare R2 (S3-compatible, free 10GB):

1. Tạo bucket: `npx wrangler r2 bucket create nhaccuahoiks-uploads`
2. Vào **Cloudflare Dashboard → R2 → Manage R2 API Tokens** → tạo token (Object Read & Write) → lấy
   `Access Key ID` / `Secret Access Key` / endpoint `https://<account-id>.r2.cloudflarestorage.com`.
3. Nạp vào secret (mục 3.3):
   - `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
   - `S3_REGION=auto`
   - `S3_BUCKET=nhaccuahoiks-uploads`
   - `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`
   - `S3_PUBLIC_BASE_URL` (nếu public) — có thể để trống và dùng route `/api/files` sẵn có.
4. Ứng dụng tự dùng driver S3 có sẵn ở `src/lib/storage/s3.ts` (đã đọc các biến `S3_*`).

> Giới hạn upload: Cloudflare cho **100 MB/request** (rộng hơn Vercel 4.5MB), nhưng nhớ **bộ nhớ Worker
> chỉ 128 MB** nên đừng để `UPLOAD_MAX_BYTES` quá lớn.

---

## 6. Build & deploy

### 6.1. `prisma generate` trong build ✅ (đã đổi sẵn)

`package.json` đã đổi `"build"` thành `"prisma generate && next build"`.

> An toàn với Render/Vercel/Docker: chúng vốn đã chạy `prisma generate` riêng, chạy thêm lần nữa không sao.

### 6.2. Chạy thử trong runtime Workers rồi deploy

```powershell
npm run preview      # build + chạy tại http://localhost:8787 (đúng runtime workerd)
npm run deploy:cf    # build + phát hành lên Cloudflare (tự cấp chuỗi Hyperdrive local)
```

> ⚠️ **Vì sao KHÔNG dùng `npm run deploy` trực tiếp?** Lệnh deploy của OpenNext gọi `getPlatformProxy`
> với `envFiles: []` (nên **không nạp `.dev.vars`**) và wrangler **bắt buộc** phải có chuỗi local cho
> Hyperdrive, nếu không sẽ báo `no local hyperdrive connection string`. Script mới `deploy:cf`
> (`scripts/cloudflare-deploy.ps1`) đọc `DIRECT_URL` từ `.env` (đã gitignore), bỏ `-pooler`, rồi gán vào
> biến `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` trước khi gọi `npm run deploy`.
> (Cách khác: thêm `localConnectionString` vào `wrangler.jsonc` — nhưng **sẽ lộ mật khẩu lên git**, không nên.)

### 6.3. Sau lần deploy đầu

1. Lệnh `deploy` in ra URL dạng `https://nhaccuahoiks.<ten>.workers.dev`.
2. Đặt `AUTH_SECRET` (nếu chưa) rồi `AUTH_URL` đúng URL đó:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   npx wrangler secret put AUTH_SECRET
   npx wrangler secret put AUTH_URL     # https://nhaccuahoiks.<ten>.workers.dev
   npm run deploy:cf
   ```
   > `wrangler secret put` tạo phiên bản mới ngay; deploy lại cho chắc.
3. Kiểm tra: `https://nhaccuahoiks.<ten>.workers.dev/api/health` → phải trả `{"status":"ok", ...}`.

### 6.4. (Tùy chọn) Tự deploy khi push GitHub

Cloudflare Dashboard → **Workers & Pages → Create → Connect to Git** → chọn repo.
Cấu hình:
- **Build command:** `npx opennextjs-cloudflare build`
- **Deploy command:** `npx wrangler deploy`
- **Node version:** 22

> Cloudflare build server chạy **Linux** nên tránh được vấn đề Windows ở mục 8.

---

## 7. Phát triển local

- `npm run dev` → vẫn là `next dev` bình thường.
- `npm run preview` → chạy trong **workerd** (giống production).
- Nếu local báo lỗi SSL/`sslmode=disable` khi nối Neon qua Hyperdrive:
  ```powershell
  npx wrangler dev --remote
  ```
  (chạy Worker ngay trong hạ tầng Cloudflare nên chuỗi kết nối hoạt động đúng).

---

## 8. Cần lưu ý & xử lý sự cố

| Hiện tượng | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `EPERM ... symlink` khi build | Windows chặn tạo symlink (OpenNext đóng gói middleware) | Bật **Developer Mode**, hoặc **PowerShell as Administrator**, hoặc dùng **CI/WSL** |
| `no local hyperdrive connection string` khi deploy | Hyperdrive thiếu chuỗi local; `.dev.vars` không được nạp lúc deploy | Dùng `npm run deploy:cf` (mục 6.2) |
| **Error 1102 (exceeded CPU time)** | Gói Free chỉ cho **10 ms CPU/request**; auth + SSR thường cần 10–20ms | Tối ưu để ít query hơn, hoặc nâng **Workers Paid ($5/tháng, CPU mặc định 30s)** — gói trả phí nên **cần thẻ** |
| Lỗi `connection ... reused` / request sau fail | Dùng **Prisma client global** | Chuyển sang `getPrisma()` tạo client mỗi request (mục 2.1) |
| `sslmode=disable` khi local | Hyperdrive kết thúc SSL nội bộ (bình thường) | Dùng `wrangler dev --remote` khi dev |
| File tải lên mất | Worker không có ổ đĩa | Dùng R2 (mục 5) |
| Build lỗi trên Windows | OpenNext hỗ trợ Windows kém | Dùng **WSL** hoặc **GitHub Actions** (mục 9) |
| Vượt 100.000 truy vấn/ngày (Free) | Giới hạn Hyperdrive Free | Chờ reset 00:00 UTC hoặc nâng Paid |
| Ảnh bị lỗi `next/image` | Worker không có `sharp` | Dùng `unoptimized` hoặc Cloudflare Images (xem `images` trong `next.config.ts`) |

---

## 9. (Khuyến nghị) Deploy bằng GitHub Actions (tránh Windows)

Tạo `.github/workflows/deploy-cloudflare.yml`:

```yaml
name: Deploy to Cloudflare Workers
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Apply database migrations (Neon, duong truc tiep)
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DIRECT_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
      - name: Build for Cloudflare
        run: npx opennextjs-cloudflare build
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

Cần thêm trong GitHub **Settings → Secrets and variables → Actions**:
- `CLOUDFLARE_API_TOKEN` (Cloudflare Dashboard → My Profile → API Tokens → template "Edit Cloudflare Workers")
- `CLOUDFLARE_ACCOUNT_ID`
- `DIRECT_URL` (chuỗi Neon trực tiếp)

> `wrangler-action` tự đọc `wrangler.jsonc` trong repo nên binding `HYPERDRIVE` và `vars` vẫn được áp.

---

## 10. Checklist nhanh

1. [x] `npm install @opennextjs/cloudflare@latest` + `npm i -D wrangler@latest`
2. [x] Thêm 4 script `preview/deploy/upload/cf-typegen` vào `package.json`
3. [x] Sửa `src/lib/db/prisma.ts` (mục 2.1)
4. [x] Sửa `next.config.ts` (mục 2.2)
5. [x] Đổi `"build"` = `prisma generate && next build`
6. [x] Tạo Hyperdrive `nhaccuahoiks-db` trên Cloudflare → **dán id vào `wrangler.jsonc`** (việc còn lại)
7. [ ] `npx wrangler login` + `npx wrangler secret put AUTH_SECRET / AUTH_URL / S3_*`
8. [ ] Tạo R2 bucket + token → điền `S3_*`; chạy `npm run db:deploy` tạo bảng (từ máy/CI)
9. [ ] `npm run deploy` → đặt lại `AUTH_URL` → deploy lại → mở `/api/health` kiểm tra

---

### Việc còn lại của bạn

Code + thư viện đã xong. Chỉ cần:
1. Dán **Hyperdrive ID** (vừa tạo trên Cloudflare) vào `wrangler.jsonc` + điền `localConnectionString` = chuỗi Neon trực tiếp.
2. Tạo **R2 bucket + API token**, nạp `S3_*` bằng `wrangler secret put`.
3. `npx wrangler login` → nạp `AUTH_SECRET`, `AUTH_URL` → `npm run db:deploy` → `npm run deploy`.


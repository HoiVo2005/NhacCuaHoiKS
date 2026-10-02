# Đẩy NhacCuaHoiKS lên Vercel (miễn phí, KHÔNG cần thẻ)

> Dành cho app **Next.js 16 full-stack + Prisma 7 + Neon Postgres** (đang chạy Render).
> Vercel là nền tảng do chính đội làm ra Next.js, gói **Hobby miễn phí và không bắt buộc thẻ tín dụng**.

---

## 1. Vì sao Vercel (và nên tránh nền tảng nào)

| Nền tảng | Miễn phí | Bắt thẻ/xác minh? | Ghi chú |
| --- | --- | --- | --- |
| **Vercel (Hobby)** | ✅ Trọn đời | ❌ Không cần thẻ | Tốt nhất cho Next.js; chỉ dùng cho mục đích **cá nhân / phi thương mại** |
| Netlify (Free) | ✅ | ❌ Không cần thẻ | Cũng chạy Next.js tốt; không mượt bằng Vercel |
| Cloudflare (Workers/Pages) | ✅ | ❌ Không cần thẻ | Phải dùng adapter `@opennextjs/cloudflare`, cấu hình nhiều hơn |
| Koyeb | ⚠️ 1 service | ✅ **Bắt buộc thẻ** | Còn tự bật nhầm gói Pro $29 → tránh |
| Northflank | ⚠️ Sandbox | ✅ **Bắt buộc thêm payment method** | Họ gọi đó là "xác minh danh tính" → tránh |
| Fly.io / Railway | ⚠️ | ✅ Bắt buộc thẻ | Tránh |

**Render** đòi thẻ ở nhiều luồng đăng ký (để chống lạm dụng free tier) → đó là lý do bạn gặp "kiểm tra".

---

## 2. Chuẩn bị

1. Đẩy code hiện tại lên GitHub (`origin main`).
2. Đăng nhập [vercel.com](https://vercel.com) bằng chính tài khoản GitHub đó → **Add New → Project → Import** repo `nhaccuahoiks`.
3. Vercel nhận diện Next.js + file `vercel.json` có sẵn trong repo (không cần chỉnh Build Command thủ công).

### Biến môi trường (Settings → Environment Variables)

Dán đúng các biến dưới đây (Production + Preview):

| Key | Giá trị |
| --- | --- |
| `DATABASE_URL` | chuỗi **-pooler** của Neon (đang có trong `.env`) |
| `DIRECT_URL` | chuỗi Neon **KHÔNG** có `-pooler` (bắt buộc, để tránh lỗi P1002) |
| `AUTH_SECRET` | 1 chuỗi ngẫu nhiên 32+ ký tự |
| `AUTH_URL` | `https://<tên-project>.vercel.app` (đổi lại sau khi gắn domain riêng) |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_USE_SECURE_COOKIES` | `true` |
| `NEXT_PUBLIC_APP_NAME` | `NhacCuaHoiKS` |
| `STORAGE_DRIVER` | `s3` (xem mục 4) |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_BASE_URL` | điền khi dùng S3 |

> `vercel.json` chạy `prisma generate && prisma migrate deploy && next build`:
> - `prisma generate` là **bắt buộc** vì Prisma Client sinh vào `node_modules/@prisma/client`
>   (không commit lên git) — dùng generator `prisma-client-js`.
> - `prisma migrate deploy` dùng `DIRECT_URL` (nhờ `prisma.config.ts`) nên không bị treo advisory lock.

---

## 3. Deploy

- Bấm **Deploy**. Mỗi lần `git push` lên `main`, Vercel tự build & phát hành lại.
- Sau khi có domain, quay lại đặt `AUTH_URL` = `https://<tên-project>.vercel.app` rồi **Redeploy** (bắt buộc, nếu không sẽ lỗi đăng nhập).
- Kiểm tra: mở `https://<tên-project>.vercel.app/api/health` → phải trả `{"status":"ok", ...}`.
- Không cần workflow `keep-warm` nữa (Vercel không cho web service "ngủ" như Render).

---

## 4. LƯU Ý QUAN TRỌNG khi chạy trên Vercel (serverless)

1. **Giới hạn 4.5 MB mỗi request.** API `/api/upload` nhận file qua `request.formData()` nên
   file nhạc lớn (mặc định `UPLOAD_MAX_BYTES=50MB`) sẽ **bị Vercel chặn** trước cả khi app kịp xử lý.
   - Cách A (nhanh, cho demo): đặt `UPLOAD_MAX_BYTES=4194304` (4 MB) và chỉ up file nhỏ.
   - Cách B (đúng chuẩn): upload trực tiếp lên S3/R2 bằng **presigned URL** — cần sửa code ở
     `src/app/api/upload/route.ts` + `src/components/admin/add-music-form.tsx`.
   - Cách C: nếu bắt buộc up file lớn → dùng nền tảng chạy **Docker/container** (xem mục 5).
2. **Ổ đĩa tạm thời.** `STORAGE_DRIVER=local` sẽ mất file mỗi lần deploy. Trên Vercel phải dùng
   `STORAGE_DRIVER=s3`. Bucket miễn phí, không cần thẻ: **Cloudflare R2** (10 GB), **Backblaze B2**
   (10 GB), **Supabase Storage** (1 GB). Driver S3 đã có sẵn ở `src/lib/storage/s3.ts`.
3. **Gói Hobby chỉ dùng cá nhân / phi thương mại.** Nếu đây là hệ thống nội bộ cho doanh nghiệp và
   có tính thương mại, xét gói Pro ($20/tháng) hoặc self-host (mục 5).
4. **Region.** Mặc định Vercel `iad1` (Mỹ) gần Neon `us-east-2` → truy vấn CSDL nhanh hơn. Đổi sang
   `sin1` (Singapore) thì gần người dùng VN hơn nhưng xa CSDL hơn → cân nhắc.
5. **Cold start** nhỏ, thường vài trăm ms — không gây màn hình chờ như Render.

---

## 5. Phương án khác nếu cần chạy Docker / up file lớn

- **Self-host bằng Docker**: `Dockerfile` + `docker-compose.yml` đã có sẵn → chạy trên VPS nội bộ/đám
  mây (máy tự quản thì không "ngủ", không giới hạn 4.5 MB). Xem mục 9.2 trong `README.md`.
- **Netlify** (Free, không thẻ): chạy Next.js, cũng là serverless nên vẫn dính giới hạn upload.
- **Cloudflare** (Free, không thẻ): rẻ và nhanh, có R2 free, nhưng cần adapter OpenNext và nhiều cấu hình.
- **Hugging Face Spaces (Docker)**: miễn phí, không cần thẻ, chạy được Dockerfile nhưng ổ đĩa tạm thời
  và có thể "ngủ" — hợp với bản demo hơn là production.

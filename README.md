# NhacCuaHoiKS — Hệ thống nghe nhạc nội bộ doanh nghiệp

Website nghe nhạc nội bộ dành cho doanh nghiệp: quản trị viên quản lý thư viện nhạc, nhân viên
nghe nhạc, tạo playlist, lưu yêu thích và theo dõi lịch sử nghe của mình.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui style · Prisma ORM 7 ·
**PostgreSQL (Neon / Render Postgres)** · Auth.js (NextAuth v5) · Zustand · Zod · Sonner.

### Thương hiệu & logo

- **Màu chủ đạo: `#3A80F6`** (xanh dương). Quy ước:
  - `--brand: #3a80f6` khai báo ở **cả hai** giao diện (đây là màu bạn chọn, dùng cho vòng focus
    `--ring`, ánh sáng nền, nền mềm, thanh trượt, chấm biểu đồ; và là `--primary` ở giao diện tối).
  - Giao diện **sáng** dùng sắc **đậm hơn** cho chữ/nút (`--primary: #2563eb`) vì `#3A80F6` trên nền
    trắng chỉ đạt 3.75 (< ngưỡng WCAG 4.5) khi làm màu chữ. Trên nền tối thì `#3A80F6` sáng nên
    đúng chuẩn, nên `--primary` bản tối chính là `#3A80F6`.
  - Nút/logo/avatar dùng `bg-gradient-brand` với 2 mốc **đậm** (`--brand-grad-from #2563eb` →
    `--brand-grad-to #4f46e5`) để chữ trắng đạt WCAG ở cả hai giao diện — _không_ đặt chữ trắng trực
    tiếp trên màu phẳng `#3A80F6`.
  - Điểm nhấn phụ: `--brand-alt` (indigo — vùng khuếch đại âm lượng > 100%) và `--brand-sky` (cyan —
    biểu tượng/biểu đồ). Riêng tim “Yêu thích” giữ màu hồng `text-rose-500` để nổi bật khỏi màu chủ đạo.
  - Cần mã màu cụ thể trong code (ví dụ màu thể loại): dùng `BRAND_COLOR` / `DEFAULT_GENRE_COLOR`
    trong `src/lib/constants.ts`.
- Logo vector: `public/logo.svg` (khối gradient **xanh dương → indigo** + nốt nhạc và sóng âm).
- Logo trong app: component `src/components/brand/logo.tsx` (`<BrandMark />`, `<BrandLockup />`) — dùng ở
  sidebar quản trị, thanh điều hướng mobile và trang đăng nhập.
- Favicon & icon khi thêm vào màn hình chính: `public/logo.svg` + `public/manifest.webmanifest`
  (khai báo trong `src/app/layout.tsx`; `theme_color` = `#3a80f6`).
- Đổi tên thương hiệu nhanh: `node scripts/set-app-name.cjs "TênMới"` (cập nhật `.env`, giữ nguyên
  `AUTH_SECRET`) rồi chạy lại `npm run build`.

---

## 1. Tính năng

### Giao diện & điều hướng

**Mobile (dưới 1024px)**

- Nút **3 gạch** ở góc trái, nhấn để **mở**, nhấn lần nữa để **đóng** (3 gạch chuyển thành dấu ✕).
- Menu tự đóng khi: chọn một mục, chạm vào nền mờ, nhấn `Esc`, hoặc bấm logo. Cuộn trang nền bị khoá khi menu mở.
- Ngăn kéo chia **nhóm điều hướng** (_Nghe nhạc_ / _Thư viện của tôi_; khu quản trị là _Quản trị_) với nhãn
  chữ in hoa nhỏ — mục đang xem có icon gradient + `aria-current="page"`.
- Nội dung menu: mục đang xem được tô sáng, mỗi mục có icon + mô tả ngắn. **Tài khoản không còn nằm trong
  menu**: khách chỉ thấy nút **Đăng nhập** ở cuối menu, người đã đăng nhập dùng menu tài khoản trên header.
- Header mobile gồm **hai hàng cao đúng 3rem (48px)** khớp nhau:
  - Hàng trên: nút 3 gạch (có khung gradient khi mở) + **logo gradient** + **tên thương hiệu tô màu gradient**;
    khi nhạc đang phát hiện thêm **sóng nhạc động** (equalizer); bên phải là nút **Sáng tạo** (ADMIN →
    _Thêm bài nhạc_, nhân viên → _Tạo playlist_), nút **đổi sáng/tối** và **avatar tài khoản** (thu gọn thành
    vòng tròn 32px, mở menu _Hồ sơ cá nhân_ / _chuyển khu vực_ / _Đăng xuất_). Khách thấy nút **Đăng nhập**
    thay cho avatar.
  - Hàng dưới **chỉ còn ô tìm kiếm dạng pill** (icon kính lúp tô màu thương hiệu, không còn khoảng trống dành
    cho phím tắt) — avatar, nút đổi giao diện và nút Sáng tạo đã được đưa lên hàng trên.
    Toàn bộ điều hướng nằm trong ngăn kéo của nút 3 gạch (không còn dải pill thừa trên header).

**Giao diện sáng / tối**

- Mặc định là **giao diện SÁNG**; bấm nút 🌙/☀️ trên header (mobile: ngay cạnh avatar; desktop: bên phải
  ô tìm kiếm) hoặc ở góc trang đăng nhập để đổi sang giao diện tối và quay lại sáng.
- Lựa chọn được lưu trong `localStorage` (`nhaccuahoiks-theme`) và áp dụng **trước khi vẽ trang**
  (`next-themes` + `suppressHydrationWarning`) nên không bị “nháy” màu khi tải lại.
- Bảng màu nằm ở `src/app/globals.css`: khối `:root` là giao diện sáng, khối `.dark` là giao diện tối.
  Mọi component dùng token (`bg-card`, `text-muted-foreground`, `border-border`, `bg-surface`…) nên
  tự đổi theo giao diện, hạn chế tối đa `dark:` thủ công.
- Các cặp token phục vụ trạng thái / nền mềm có mặt ở **cả hai** giao diện, nên badge và nhãn cảnh báo
  luôn đọc được ở cả sáng lẫn tối:
  - Nền mềm + chữ trên nền đó: `bg-primary-soft`, `bg-success-soft`, `bg-warning-soft`,
    `bg-destructive-soft` đi kèm `text-*-soft-foreground` (ví dụ badge, danh sách cảnh báo, banner lỗi).
  - Viền nổi bật cho khung ảnh/video: `border-border-strong`; lớp phủ modal/ngăn kéo: `bg-overlay`.
  - Màu nguồn phát cho biểu đồ & chấm màu: `--source-youtube|soundcloud|tiktok|uploaded` (bản sáng dùng
    sắc đậm hơn để không bị “nhạt” trên nền trắng; bản tối giữ đúng màu thương hiệu).
  - Bộ màu thương hiệu: `--brand` (**#3A80F6** – màu chủ đạo), `--brand-alt` (indigo), `--brand-sky` (cyan),
    `--brand-grad-from/to` (2 mốc gradient của nút & logo). Đổi màu chủ đạo chỉ cần sửa nhóm token này.
  - `bg-gradient-brand` khai báo bằng **`@utility`** (không đặt trong `@layer components`) vì Tailwind v4 chỉ
    sinh CSS cho **biến thể** (`data-[state=checked]:bg-gradient-brand` của ô tick) khi class là utility thật —
    class thường trong lớp components bị bỏ qua phần biến thể, khiến dấu tích trắng nằm trên nền gần trắng ở
    giao diện sáng nên **mất dấu tích**. `npm run check:theme` khoá lại quy ước này.
  - Thanh trượt, vệt sáng nền, vòng focus… lấy theo `--foreground`/`--primary` qua `color-mix()` nên tự
    đổi màu theo giao diện (trước đây rãnh thanh trượt là `rgba(255,255,255,.15)` → mất hút trên nền sáng).
  - Bản tối giữ `--primary`/`--destructive` **sáng** để làm màu chữ trên nền đậm, nên chữ trên nút
    (`--primary-foreground`, `--destructive-foreground`) là **màu mực đậm** thay vì màu trắng
    (chữ trắng trên tím sáng chỉ đạt 4.2 — dưới ngưỡng WCAG 4.5).
  - `theme-color` của thanh trình duyệt trên điện thoại có cả bản sáng lẫn bản tối theo `prefers-color-scheme`
    (trước đây luôn là `#07070f` nên thanh trình duyệt lệ màu ở giao diện sáng).
- Toàn bộ các điểm trên được **kiểm chứng tự động** bằng `npm run check:theme`: đối chiếu hai khối token,
  tính độ tương phản WCAG cho hơn 30 cặp màu ở **cả hai** giao diện, kiểm tra **hệ thống thiết kế** (đủ 8
  utility dùng lại, 4 cấp bóng, keyframe chuyển động, và các component phải dùng chung utility), xác nhận màu
  chủ đạo `#3A80F6` được dùng đồng bộ (token, manifest, logo) và quét mã nguồn tìm màu “chỉ hợp nền tối”
  (`text-*-100..300`, `bg/border-white/…`) hay mã màu thương hiệu cũ còn sót lại.

**Ngôn ngữ thiết kế (học từ Spotify / Apple Music)**

Mọi bề mặt đều dựng từ **một primitive dùng lại** thay vì mỗi trang tự vẽ một kiểu. Bộ utility nằm trong
`src/app/globals.css`:

| Utility             | Công dụng                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card-surface`      | Nền kính mờ + viền mềm + bóng cấp 1 — dùng cho thẻ bài nhạc, playlist, thẻ thống kê, khung xương                                                                     |
| `lift`              | Nâng thẻ lên 3px + bóng đậm hơn khi hover (mọi thẻ đều dùng cùng một nhịp chuyển động)                                                                               |
| `art-frame`         | Khung bìa nhạc: bo góc + viền + bóng, ảnh tự zoom 6% khi hover thẻ cha                                                                                               |
| `hero-mesh`         | Nền hero: mesh gradient + lưới mờ dựng bằng token màu chủ đạo (không cần ảnh ngoài)                                                                                  |
| `hairline`          | Vệt sáng gradient ngăn cách các “shelf” và chân header/sidebar                                                                                                       |
| `chip-glass`        | Chip kính mờ (số liệu trên hero, thanh “Phát tất cả”)                                                                                                                |
| `equalize-bars`     | Sóng nhạc động báo “đang phát” (thay cho ký tự ♪ tĩnh)                                                                                                               |
| `bg-gradient-brand` | Nền gradient 2 mốc đậm của nút/logo/avatar **và ô tick** — khai báo bằng `@utility` nên dùng được với biến thể (`data-[state=checked]:bg-gradient-brand`, `hover:`…) |
| Bóng 4 cấp          | `shadow-soft` · `shadow-card` · `shadow-float` · `shadow-brand` (token `--elev-*`, khác nhau ở 2 giao diện)                                                          |
| Chuyển động         | `animate-fade-up` (section hiện dần) · `animate-shimmer` (vệt sáng chạy qua khung xương)                                                                             |

Quy ước áp dụng:

- **Trang chủ là sản phẩm, không phải trang giới thiệu**: hero có nút **Phát ngay** cho bài nổi bật và chip
  số liệu; người dùng vào là nghe được ngay.
- **Dải nội dung (“shelf”) + tiêu đề dùng lại**: `SectionHeader` (`src/components/music/section-header.tsx`)
  gói icon + tiêu đề + mô tả ngắn + liên kết “Xem tất cả ›”, phía dưới có `hairline`. Mọi mục trên trang chủ
  đều dùng chung component này.
- **Thẻ bìa là nhân vật chính**: tiêu đề đậm hơn nghệ sĩ; chip thời lượng/số bài ở góc bìa; nút phát gradient
  trượt lên khi hover; thẻ đang phát được đánh dấu bằng viền màu chủ đạo **và** sóng nhạc động.
- **Hàng danh sách** (`SongRow`) cũng theo luật đó: số thứ tự đổi thành sóng nhạc khi đang phát, bìa dùng
  `art-frame`, tiêu đề đậm + màu chủ đạo khi đang phát.
- **Không dùng ảnh trang trí tải từ mạng**: mọi hình khối (mesh gradient, lưới, watermark logo, quầng sáng,
  chip kính) đều dựng bằng CSS/token; biểu tượng dùng bộ `lucide-react` đã có sẵn trong dự án nên giao diện
  không phụ thuộc file ngoài và tự đổi màu theo 2 giao diện.
- **Ảnh bìa luôn lấy bản nét nhất (không bị mờ khi phóng to)**: bìa của bài YouTube/SoundCloud do nền tảng trả
  về thường chỉ **480×360** (`hqdefault`, lại là khung **4:3 có viền đen**) nên khi hiển thị ở khung vuông/khung
  lớn, ảnh bị kéo giãn → **mờ**. Mọi URL bìa đi qua **một nơi duy nhất** `src/lib/music/thumbnails.ts`: tự nâng
  lên bản nét nhất (`maxresdefault` **1280×720** cho YouTube, `-t500x500` cho SoundCloud) và **tự hạ cấp** khi
  bản nét nhất không tồn tại (video cũ/video dọc) theo chuỗi dự phòng `maxresdefault → sddefault → hqdefault` —
  không bao giờ để lại ảnh vỡ, cũng không bao giờ hiện nhầm ảnh của bài khác.
  - Việc nâng cấp được áp **ngay khi trả DTO** (`src/lib/mappers.ts` cho cả bài nhạc lẫn bìa playlist) nên
    **bài đã lưu trong CSDL cũng nét lại, không cần migrate dữ liệu**.
  - Giao diện dùng chung component `src/components/ui/artwork.tsx` (`<Artwork>` — client component bắt `onError`
    để hạ cấp, có khung ♪ khi hết ảnh): **mọi chỗ hiện bìa** (thẻ bài nhạc, hàng danh sách, hàng chờ, thanh phát,
    trình phát đầy đủ, ô tìm kiếm nhanh, bảng thư viện nhạc, bìa playlist) đều dùng component này — không còn
    thẻ `<img>` nào tự gọi URL bìa.
  - Khi thêm bài mới, adapter YouTube cũng lấy bản nét nhất từ oEmbed/Data API (`maxres` → `standard` → `high`).
  - Kiểm chứng bằng `npm run check:thumbs` (kiểm cả URL thật trên `i.ytimg.com` bằng `HEAD`; mất mạng thì `SKIP`).

**Desktop (từ 1024px)**

- Sidebar cố định bên trái, có **vệt sáng màu chủ đạo** dưới logo và menu **chia nhóm**; mục đang mở có
  vạch chỉ báo gradient bên trái + `aria-current`; header hiển thị **tên trang + mô tả** theo đúng mục đang
  mở (ví dụ “Thư viện nhạc · Quản lý toàn bộ bài nhạc”), kèm icon tương ứng.
- Mục được tô sáng là mục **khớp cụ thể nhất** với đường dẫn, nên **không bao giờ có 2 mục cùng sáng**: ở
  `/admin/music/new` chỉ _Thêm bài nhạc_ sáng (_Thư viện nhạc_ không sáng nữa), còn trang chi tiết
  `/music/playlists/abc` vẫn giữ _Playlist của tôi_ sáng. Cùng một hàm `isActiveNav` dùng cho cả sidebar
  desktop lẫn ngăn kéo mobile, có test tự động trong `npm run check:nav`.
- Ô tìm kiếm dạng pill ở giữa, có nút xoá từ khoá, gợi ý phím tắt **Ctrl/⌘ + K** hoặc **/** để focus nhanh,
  gợi ý kết quả dạng thẻ có ảnh bìa và nút “Xem tất cả kết quả”.
- Bên phải (chỉ hiển thị từ 1024px — trên mobile các nút này nằm ở header mobile): chip người dùng
  (tên + vai trò) mở menu hồ sơ / đăng xuất; với ADMIN có thêm nút chuyển nhanh giữa **khu quản trị**
  và **khu nghe nhạc**.

### Khách (chưa đăng nhập) — **không bắt buộc đăng nhập để nghe nhạc**

- Vào trang chủ (`/`) được đưa thẳng tới khu nghe nhạc `/music` — **hiển thị luôn, không chặn đăng nhập**.
- Nghe được toàn bộ bài nhạc đã xuất bản qua trình phát toàn cục (YouTube/SoundCloud/TikTok/file nội bộ),
  xem khám phá, tìm kiếm, xem playlist công khai.
- Thanh điều hướng/sidebar hiện nút **Đăng nhập**; các trang cá nhân (Yêu thích, Lịch sử, Hồ sơ,
  Playlist của tôi) sẽ chuyển hướng về `/login?callbackUrl=...` và quay lại đúng trang sau khi đăng nhập.
- Bấm **yêu thích** hoặc **thêm vào playlist** khi chưa đăng nhập sẽ hiện gợi ý đăng nhập thay vì báo lỗi.
- Khách **không** lưu lịch sử nghe và không thấy playlist riêng tư của người khác (nhận 403).

### Dành cho nhân viên (EMPLOYEE)

- **Trang chủ**: nghe tiếp (mỗi bài chỉ hiện **một lần**, không lặp lại dù bạn đã nghe lại nhiều lần),
  playlist nổi bật, nhạc mới, nhạc nghe nhiều nhất. Mỗi mục đều có liên kết **“Xem tất cả ›”**
  (nghe tiếp → `/music/history`, playlist nổi bật → `/music/playlists`, nhạc mới → `/music/discover`,
  nghe nhiều nhất → `/music/discover?sort=plays`).
  Con số ở banner chào mừng (“Tổng hợp _N_ bài nhạc nổi bật”) đếm **theo id** nên bài nằm ở cả hai
  danh sách “Mới thêm” và “Nghe nhiều nhất” chỉ được tính **một lần** (`countUniqueSongs`).
- **Khám phá**: lọc theo thể loại, nguồn phát (YouTube/SoundCloud/TikTok/File) và thứ tự, có phân trang.
- **Tìm kiếm**: tìm bài nhạc, nghệ sĩ, thể loại; gợi ý nhanh ngay trên thanh tìm kiếm.
- **Yêu thích**: lưu/bỏ yêu thích tức thì.
- **Playlist cá nhân**: tạo, sửa, xoá, chia sẻ nội bộ, thêm/xoá bài hát.
- **Lịch sử nghe**: thống kê lượt nghe, thời lượng đã nghe, xoá từng mục hoặc toàn bộ.
  Tick checkbox để chọn nhiều lượt nghe rồi xoá một lần (nhanh hơn xoá từng dòng).
- **Nhịp nghe** (`/music/stats`): trang thống kê thói quen nghe của **chính bạn** — biểu đồ 30 ngày,
  **giờ vàng** (khung 3 giờ theo giờ máy của bạn), chuỗi ngày liên tiếp (streak) + kỷ lục, top nghệ sĩ /
  thể loại / nguồn phát và top 8 bài nghe nhiều nhất **bấm là phát lại được** (dùng lại `StatGrid`,
  `PlaysLineChart`, `RankedList`, `SourceBreakdown` của dashboard quản trị nên hai khu nhìn cùng một kiểu).
  Số liệu tổng (lượt nghe, thời lượng, số bài khác nhau) tính bằng truy vấn tổng hợp; phần thói quen chỉ
  đọc 60 ngày gần nhất nên không kéo cả bảng lịch sử về server. Kiểm chứng bằng `npm run check:insights`.
- **Trình phát nhạc toàn cục**: nhạc chạy liên tục khi chuyển trang.
- **Hồ sơ cá nhân**: đổi tên hiển thị, ảnh đại diện, mật khẩu.

### Trình phát nhạc (global player)

- Hàng chờ (queue), phát ngẫu nhiên (shuffle), lặp lại (off/all/one), kéo thả thứ tự bài.
- Thanh tiến trình + tua nhạc, chỉnh âm lượng, tắt tiếng, lưu trạng thái vào `localStorage`.
- **Chế độ video**: khung video nổi 320×180 hoặc trình phát toàn màn hình.
  - Trong trình phát toàn màn hình, khung video **cuộn theo nội dung** thay vì đứng yên trên màn hình:
    trình phát dành một “ô chỗ video” (khung `aspect-video` trong suốt) nằm trong luồng trang, còn
    khung video thật (`position: fixed` ở gốc trang — không đổi phần tử cha được vì iframe sẽ tải lại
    từ đầu) bám theo toạ độ của ô đó mỗi khi cuộn/đổi kích thước. Nhờ vậy khi bạn kéo lên, video đi
    lên cùng tiêu đề/nghệ sĩ bên dưới, không còn che mất thông tin bài nhạc.
  - Phần khung video tràn ra ngoài vùng cuộn bị `clip-path` cắt bớt, nên video không bao giờ đè lên
    header “Đang phát”. Đóng trình phát thì mọi toạ độ được xoá, video về đúng vị trí mặc định.
  - Khung video được **căn giữa** bằng cặp class `left-1/2 -translate-x-1/2`; khi bám theo ô chỗ, toạ độ
    được đặt bằng inline style và **cả `transform` lẫn `translate`** đều bị đặt về `none`.
    Lưu ý: Tailwind v4 dịch `-translate-x-1/2` thành thuộc tính **`translate`** (không phải `transform`
    như v3), nên chỉ đặt `transform: none` là **không đủ** — phép dịch `-50%` còn lại sẽ đẩy video lệch
    sang trái đúng nửa chiều rộng (lỗi “video không nằm chính giữa”).
  - Kiểm chứng bằng `npm run check:video`.
- Điều khiển bằng API/SDK **chính thức** của từng nền tảng:
  - YouTube: IFrame Player API
  - SoundCloud: Widget API
  - TikTok: TikTok Embed Player + `postMessage`
  - File nội bộ: thẻ `<audio>` HTML5 (hỗ trợ HTTP Range để tua)
- Tự động cập nhật **thời lượng** vào CSDL khi trình phát biết chính xác thời lượng.
- Ghi nhận lịch sử nghe **tiết kiệm request** (chi tiết ở mục _Tối ưu tốc độ tải trang_):
  - Chỉ tính là một lượt nghe khi bài đã phát **≥ 5 giây** (bấm nhầm / skip nhanh không tạo rác), sau đó
    cập nhật khi vị trí nghe **tiến thêm ≥ 30 giây**, gửi nốt khi tạm dừng và đánh dấu khi nghe hết.
  - Nhịp kiểm tra 5 giây/lần nhưng **chỉ đọc trạng thái trong bộ nhớ** (không gọi API); luôn chỉ có **một**
    request `/api/history` đang bay (single-flight) nên không dồn hàng đợi vào server — trước đây mỗi lần
    play/pause (kể cả những lần trình phát tự báo khi chuyển bài hoặc tua) đều gửi thêm một request 0ms.
  - Server bỏ qua lượt ghi khi không có gì mới (cùng vị trí) → bớt một vòng truy vấn CSDL.
  - Kiểm chứng bằng `npm run check:history`.
- **Nghe tiếp từ chỗ dừng** (phát nốt chỗ đang nghe dở): mỗi bài được nhớ **một** vị trí, lưu trong
  `localStorage` (khoá `resume` của `src/store/player-store.ts`) nên mở lại trang vẫn nghe tiếp đúng chỗ.
  - **Chỉ nhớ khi thật cần**: đã nghe **≥ 20 giây** (bấm nhầm/nghe lướt không để lại dấu vết) và vị trí được
    làm tròn theo **bước 5 giây** — cùng một chỗ trong 5 giây chỉ tạo **một** bản ghi, không ghi
    `localStorage` liên tục làm giật nhạc (đúng tinh thần `src/lib/throttled-storage.ts`).
  - **Không “nghe tiếp” vô duyên**: còn **≤ 15 giây** cuối bài (coi như đã nghe xong), vị trí dài hơn thời
    lượng bài, hoặc dữ liệu trong `localStorage` bị sửa tay → phát lại từ đầu. Tua **về sát đầu bài** cũng
    xoá vị trí đã nhớ, để lần sau không nhảy vào giữa bài mà bạn vừa cố tình bỏ qua.
  - Bài bắt đầu từ giữa thì hiện thông báo **nói rõ lý do** (“Nghe tiếp … từ 2:15”) kèm nút **“Về đầu bài”**
    — không để người dùng tưởng trình phát lỗi.
  - Mọi nguồn đều nạp được từ vị trí đã lưu: file nội bộ đặt `currentTime`, YouTube truyền `startSeconds`,
    SoundCloud/TikTok gọi `seekTo`. Luật nằm ở `src/lib/resume.ts` (bộ nhớ tối đa 200 bài) —
    kiểm chứng bằng `npm run check:resume` (có cả phần chạy trên store thật, không cần CSDL/server).
- **Điều khiển từ màn hình khoá / tai nghe** (Media Session API): tiêu đề, nghệ sĩ, **ảnh bìa nét nhất**,
  thanh kéo thời gian và các nút Phát/Tạm dừng/Tua ±10s/Bài trước/Bài sau hiện ngay trên **màn hình khoá**,
  thanh thông báo Android và tai nghe Bluetooth — không phải mở lại trình duyệt.
  - Chỉ đăng ký hành động mà nguồn đang phát **thực sự hỗ trợ** (`PLAYER_CAPABILITIES`): nguồn không tua được
    thì màn hình khoá không hiện nút tua vô tác dụng.
  - Vị trí chỉ được đẩy lên **5 giây một lần khi đang phát** (trình duyệt tự nội suy giữa hai lần cập nhật),
    cập nhật ngay khi tạm dừng hoặc vừa tua. Mọi giá trị đều được kiểm tra trước khi gọi API vì
    `setPositionState()` **ném lỗi** khi chưa biết thời lượng hoặc vị trí vượt quá thời lượng.
  - Mọi lệnh gọi API đều được bao bọc: trình duyệt không hỗ trợ (`seekto`/`stop` trên Safari, hoặc trang chạy
    qua HTTP thường không có `navigator.mediaSession`) thì **bỏ qua**, không làm vỡ trang.
  - Luật nằm ở `src/lib/media-session.ts`, cầu nối ở `src/components/player/media-session-bridge.tsx` —
    kiểm chứng bằng `npm run check:media`.

- **Trình bày trên điện thoại** (hai chỗ trước đây khó dùng, đã sửa):
  - **Hẹn giờ tắt nhạc**: dưới 640px, menu nhỏ được thay bằng **panel rộng nổi phía trên thanh phát** —
    dùng **cùng bộ class** với panel “Danh sách phát” nên nhìn và bấm giống hệt nhau; đóng bằng nút `X`,
    nút “Đóng” hoặc phím `Esc`. Trên desktop vẫn là menu nhỏ mở lên trên (`side="top"`) như cũ.
  - Panel và “Danh sách phát” dùng **nền đục** `bg-popover/95` + `backdrop-blur-xl` chứ **không** dùng
    `.glass`: `.glass` chỉ đặc 72–84% nên trên panel lớn, chữ phía sau lọt qua làm chữ trên panel bị
    “mờ”, khó đọc (`npm run check:sleep` chặn không cho quay lại `glass safe-bottom`).
  - **Âm lượng**: **icon loa** mở panel có **thanh trượt DỌC** — **kéo lên = to hơn, kéo xuống = nhỏ hơn**,
    kèm nút Tắt/Bật tiếng và “Tối đa” (mức cao nhất mà nguồn đang phát cho phép). Thanh trượt là component
    riêng `src/components/player/vertical-volume-slider.tsx`, **chạm vào đâu trong khung 44×160px cũng
    nhảy tới mức đó rồi kéo tiếp**; kéo lệch ra ngoài khung vẫn tính tiếp (`setPointerCapture`) nên không
    còn cảnh “kéo không ăn” như bản dùng `<input type="range">` xoay `-90deg` (vùng chạm chỉ 22px, lại bị
    hiểu là bấm ra ngoài nên panel tự đóng). Panel không tự đóng khi đang kéo
    (`data-dropdown-keep-open`) và không bị cuộn trang (`touch-none`); dùng được cả bàn phím
    (`↑`/`↓`/`Home`/`End`) và có `role="slider"` cho trình đọc màn hình.
    Panel chốt `align="left"` (nút loa nằm ở **đầu hàng**) và rộng `min(82vw, 300px)`: nếu để
    `align="right"` thì panel bị đẩy ra ngoài mép trái, người dùng chỉ thấy một dải bị cắt.
  - Cả hai dùng hook `useIsMobile()` (`src/hooks/use-is-mobile.ts` — `matchMedia("(max-width: 639px)")`,
    có giá trị riêng cho SSR để không lệch hydration). Phải **chọn một** cách trình bày thay vì render cả
    hai rồi ẩn bằng CSS: bản bị ẩn vẫn nghe sự kiện `mousedown` và sẽ đóng panel đang mở của bản kia.
  - Kiểm chứng bằng `npm run check:sleep` và `npm run check:volume` (có phép thử **toán học** vị trí ngón
    tay → mức âm lượng: đáy = 0%, đỉnh = 100%, kéo ra ngoài bị kẹp trong khoảng, khung cao 0 thì không
    chia cho 0; kèm kiểm tra khung chạm 44×160px và có `setPointerCapture`).

Độ bền của trình phát (kiểm chứng bằng `npm run check:youtube`):

- Chờ sự kiện `onReady` trước khi gọi `playVideo`/`loadVideoById` — tránh lỗi
  `playVideo is not a function` khi React StrictMode gọi effect 2 lần (player chưa sẵn sàng).
- Không để YouTube thay thế `<div>` do React quản lý: engine tạo một _mount node_ con rồi mới
  đưa cho YT, nhờ đó khung video ẩn/hiện/nổi giữ đúng class và không còn iframe "mồ côi".
- Âm lượng, tắt tiếng và vị trí tua đặt **trước** khi player sẵn sàng sẽ được áp dụng ngay sau `onReady`.
- Nếu YouTube không sẵn sàng sau 15 giây, hệ thống báo lỗi rõ ràng và cho phép phát lại
  (thay vì treo hoặc ném TypeError).
- **Âm lượng**: kéo thanh trượt ở thanh phát nhỏ hoặc trình phát đầy đủ; thanh trượt **không bao giờ bị
  khoá** và chỉ dài tới **mức tối đa thực tế của nguồn đang phát** (trước đây mọi nguồn đều dài 0–200%
  nên với nguồn nhúng, đoạn 100–200% là “vùng chết”: kéo mà âm thanh không to hơn → tưởng hỏng).
  - **File tải lên**: 0–200%, phần vượt 100% được tô màu hồng riêng + vạch mốc 100% + nút “Về 100%”;
    khuếch đại thật bằng **Web Audio API** (GainNode) kèm **limiter** (DynamicsCompressor) để giảm vỡ tiếng.
  - **Nguồn nhúng (YouTube/SoundCloud/TikTok)**: 0–100% (nền tảng chặn khuếch đại) — trình phát ghi rõ
    “Nguồn nhúng (YouTube/SoundCloud/TikTok) tối đa 100% — chỉ file tải lên mới khuếch đại quá 100%”.
  - **TikTok**: API chính thức chỉ có `mute`/`unMute` (không có lệnh đặt mức âm lượng), nên thanh trượt
    có tác dụng ở mốc **0% = tắt tiếng**; trình phát hiện ghi chú chỉ dẫn bấm **nút loa trong khung video**
    để chỉnh mức nhỏ/lớn. Mức âm lượng và trạng thái tắt tiếng được gộp lại trước khi gửi lệnh, nên
    `setMuted(false)` không ghi đè lệnh tắt tiếng do kéo về 0%, và bấm phát lại không tự bật tiếng.
  - **Vùng kéo**: hộp của thanh trượt cao **22px** trên mọi kích thước màn hình trong khi rãnh vẫn mảnh
    6px — kéo bằng ngón tay hay chuột đều dễ (trước đây trên desktop hộp chỉ cao 6px nên rất khó kéo trúng).
  - **Điện thoại**: thanh phát nhỏ có **hàng âm lượng riêng** (nút tắt/bật tiếng + thanh trượt + %).
  - **SoundCloud**: mức âm lượng người dùng chọn được ghi nhớ và áp dụng lại cho widget mới (đổi bài
    không làm mất âm lượng), bật tiếng lại trả về **đúng mức đã chọn** thay vì một mức cố định.
  - Kiểm chứng bằng `npm run check:volume` và `npm run check:soundcloud`.
- **Thanh thời gian (tua bài)**: thả chuột/ngón tay ở đâu cũng được ghi nhận — kể cả khi thả ra ngoài
  thanh trượt hoặc trình duyệt huỷ thao tác (`pointercancel`); phím `←` `→` / `Home` / `End` cũng tua
  được. Vị trí tua luôn được giới hạn trong `[0, thời lượng]`. Ngay sau khi tua, hệ thống **bỏ qua các
  báo cáo vị trí cũ** của động cơ (thẻ `<audio>` bắn `timeupdate` trong lúc đang seek; SoundCloud/YouTube
  hỏi vị trí mỗi ~1 giây) nên thanh thời gian không bị “nhảy ngược rồi nhảy lại”; nếu động cơ không xác
  nhận trong 2,5 giây thì tự chấp nhận vị trí thực tế (không bị kẹt). Nút **Bài trước** khi đã nghe quá
  5 giây cũng tua thật về đầu bài (trước đây chỉ đổi số trên giao diện).
  Kiểm chứng bằng `npm run check:seek`.
- **Hẹn giờ tắt nhạc**: nút hình **đồng hồ** trên thanh phát mở menu chọn **5 / 10 / 15 / 30 / 45 / 60 phút**,
  **tự chọn số phút bất kỳ (1–720 phút)**, **tự chọn giờ tắt** (ví dụ `23:30`), hoặc **tắt sau N bài** —
  các mốc nhanh `Hết bài này / 2 / 3 / 5 / 10 bài` hay tự nhập **1–99 bài** (bài đang phát được tính là bài thứ nhất).
  Khi đang hẹn giờ, nút sáng màu thương hiệu và hiện `phút:giây` còn lại (chế độ đếm bài thì hiện `N bài`,
  còn đúng 1 bài nữa là `Hết bài`).
  (trên điện thoại nhãn được ẩn cho gọn — mở lại menu để xem thời gian còn lại ở dòng đầu).
  - Hết thời gian / hết số bài → **tạm dừng phát** (bài vẫn còn nguyên để bấm Phát nghe tiếp) và hẹn giờ tự tắt, nên lần
    bấm Phát sau đó nhạc chạy bình thường.
  - Kiểu **tắt sau N bài**: hết bài thứ N thì dừng — **không** tự chuyển bài (các lượt nghe vẫn được ghi).
    Chọn **1 bài** chính là “hết bài này thì tắt” như trước đây. Nếu hàng chờ hết bài trước khi đủ N (không còn
    bài kế tiếp) hay người dùng xoá hàng chờ thì hẹn giờ cũng tự tắt, để nút không hiện số bài cũ.
  - Tự chọn giờ: chưa tới giờ đó trong ngày thì hẹn hôm nay, đã qua thì hiểu là **ngày mai** (chọn đúng phút hiện
    tại thì tắt sau 1 phút); nhập số phút sai (0, 721, chữ, để trống) → báo lỗi ngay trong menu và **không** hẹn
    bừa. Dòng mô tả ở đầu menu luôn ghi rõ còn bao lâu **và** tắt lúc mấy giờ: `(lúc 23:30)`.
  - Hạn chót được kiểm tra **mỗi khi trạng thái trình phát thay đổi** (động cơ báo tiến độ ~4 lần/giây) chứ
    không chỉ dựa vào `setInterval`, vì trình duyệt bóp nhịp `setInterval` khi tab bị ẩn → nhạc vẫn tắt đúng lúc.
  - Menu mở **lên trên** (`side="top"` của `src/components/ui/dropdown.tsx`) do thanh phát nằm sát đáy cửa sổ;
    bấm vào ô nhập hay nút `data-dropdown-keep-open` (nút “Hẹn”/“Tắt lúc”) **không** làm đóng menu để còn sửa khi
    nhập sai, còn hẹn xong thì menu tự đóng ngay;
    hẹn giờ **không** lưu vào `localStorage` nên mở lại trang không còn hẹn giờ cũ.
  - Kiểm chứng bằng `npm run check:sleep`.
- **Mix quanh bài này** (radio thông minh): nút trên thanh phát (biểu tượng sóng) và trong trình phát đầy đủ
  tạo một **hàng chờ mới** gồm các bài tương đồng với bài đang phát, rồi phát luôn.
  - Cách chọn bài: gom ứng viên theo **cùng thể loại / cùng nghệ sĩ / cùng nền tảng phát** (mỗi nhóm lấy
    riêng nên một thể loại lớn không “nuốt” hết kết quả), sau đó chấm điểm: thể loại 6 · nghệ sĩ 4 · mỗi thẻ
    trùng 2 (tối đa 4) · cùng nguồn phát 1 · thời lượng lệch ≤ 90 giây 1.
  - Cùng điểm thì bài **nghe nhiều hơn** đứng trước, cuối cùng sắp theo tên A→Z nên kết quả **ổn định**
    (bấm lại không thấy danh sách nhảy lung tung) — đây cũng là điều kiện để test được.
  - Thư viện nhỏ/chưa có bài tương đồng thì bù bằng các bài nghe nhiều nhất, nên mix luôn có nhạc để phát.
  - API `GET /api/songs/:id/mix` (khách chưa đăng nhập vẫn dùng được vì chỉ đọc bài đã phát hành, có session
    thì kèm cờ yêu thích — route này đã khai báo trong danh sách API công khai của `src/proxy.ts`, nếu quên
    thì khách bấm nút Mix sẽ nhận 401). Luật trộn nằm ở `src/lib/music/mix.ts` — kiểm chứng bằng
    `npm run check:mix` (kèm `npm run check:guest` để thử bằng request thật).
- **Phím tắt trình phát**: `Space` phát/tạm dừng · `←`/`→` tua ±5s · `Shift`+`←`/`→` đổi bài · `↑`/`↓` âm lượng ·
  `M` tắt tiếng · `S` ngẫu nhiên · `R` lặp lại · `L` yêu thích bài đang phát · `Q` hàng chờ · `F` trình phát
  đầy đủ · `Ctrl/⌘ + K` (hoặc `/`) mở ô tìm kiếm nhanh · `?` mở bảng trợ giúp (cũng có nút bàn phím trên thanh
  phát; trên điện thoại nút này ẩn vì không có bàn phím thật).
  - Phím tắt được **bỏ qua khi bạn đang gõ** vào ô nhập liệu/vùng soạn thảo, khi **giữ Ctrl/⌘/Alt** và khi
    **đang mở hộp thoại/menu Radix** (mũi tên và chữ cái thuộc về lớp phủ đang mở, ví dụ menu hẹn giờ).
    Riêng `Ctrl/⌘ + K` là **lệnh toàn cục**: cố ý chạy cả khi đang gõ (giống Slack/YouTube) nhưng vẫn nhường
    phím khi đang mở hộp thoại, và **không** chiếm `Ctrl + Shift + K` / `Ctrl + Alt + K` của trình duyệt.
  - Ô tìm kiếm trên header **đăng ký** hàm focus của nó với hệ thống phím tắt (`src/lib/quick-search.ts`) thay
    vì tự nghe `keydown`; nhờ vậy phím này cũng nằm trong bảng trợ giúp `?` và có kiểm chứng tự động. Phím `/`
    vẫn được xử lý ngay tại header vì chỉ có ý nghĩa khi trang đang mở ô tìm kiếm.
  - Bảng trợ giúp chia theo nhóm (Phát nhạc · Âm thanh · Giao diện), mở/đóng bằng chính phím `?` và **không**
    lưu trạng thái vào `localStorage`. Quy tắc phím nằm ở `src/lib/player-shortcuts.ts` —
    kiểm chứng bằng `npm run check:shortcuts`.
- **Lời bài hát kiểu karaoke** (phím `Y` hoặc nút micro trên thanh phát / nút “Lời bài hát” trong trình phát
  đầy đủ): dòng đang hát được **tô sáng và tự cuộn vào giữa**, bấm vào một dòng để **tua tới đúng chỗ**, và có
  nút chỉnh lệch **±0.5s** cho những bản thu chạy sớm/muộn hơn bản gốc.
  - Nguồn lời: **LRCLIB** (`lrclib.net`, API công khai không cần khoá). Server tra theo thứ tự “chính xác
    nhất trước”: với **từng biến thể tên bài** (bản đã làm sạch → bản gốc → từng đoạn sau dấu `|` → phần trước
    `-`) lần lượt thử `/get` (kèm thời lượng) → `/search` kèm nghệ sĩ → `/search` **chỉ theo tên bài**.
    - Tên bài được “làm sạch” trước khi tra (`(Official Video)`, `Lyric Video`, `(Audio)`, `- Topic`… và các
      đoạn tên kênh sau dấu `|`) nhưng **giữ nguyên** các bản khác về lời (`Remix`, `Live`, `Karaoke`).
    - Bước “tìm chỉ theo tên bài” là cần thiết vì cột `artist` trong thư viện thường là **kênh YouTube/người
      remix** (`Mây Saigon Official`, `VietZ`) — lọc theo nghệ sĩ sẽ làm mất kết quả đúng.
    - Có **ngân sách** 12 lượt gọi và trần **15 giây** cho một bài: bài hiếm không làm người dùng chờ vô ích.
      Vượt ngân sách hoặc mạng lỗi → trả `unavailable` và **không ghi cache** (lần sau tự thử lại).
    - Nếu chỉ có lời thường (không mốc thời gian) thì hiện như văn bản và ghi rõ là không tự chạy; không tìm
      thấy lời thì báo “Chưa tìm thấy lời” kèm nút tra cứu lại (và nút dán lời cho quản trị viên).
  - **Lời được lưu trong CSDL** (bảng `song_lyrics`, migration `add_song_lyrics`) nên lần sau mở bài là có ngay,
    không phải chờ mạng và không làm phiền API bên ngoài. Lần tra cứu không thấy lời cũng được ghi nhớ — chỉ thử
    lại sau 14 ngày.
  - **Thêm bài nhạc mới là tự lấy lời ngay** (chạy **nền**, không làm chậm thao tác thêm bài) nên người đầu tiên
    mở bài là đã có lời. Các bài **đã có trong thư viện từ trước** thì bấm nút **“Lấy lời cho N bài”** ở đầu trang
    _Thư viện nhạc_: hệ thống tự lấy lời cho từng đợt 20 bài (nghỉ 0,25 giây giữa các bài cho lịch sự với LRCLIB,
    tối đa 10 đợt mỗi lần bấm) và dừng khi hết bài hoặc không còn tiến triển; nút tự hiện “Bài nào cũng có lời”
    khi xong. Bài vừa tra cứu xong sẽ không được chọn lại ngay, nên bấm nhiều lần cũng không lặp vô hạn.
  - **Chỉ tự tìm lời cho “bài hát đơn”**: bỏ qua liên khúc (LK), mix/nonstop/mashup/medley, tuyển tập/tổng hợp/
    best of/top N/vol N, bài dài hơn **10 phút**, và tiêu đề gồm **≥4 đoạn** ngăn cách bằng `|` — vì những mục
    này chứa nhiều bài nên tra cứu tự động rất dễ ra lời sai. Bảng lời **nói rõ lý do** bỏ qua, quản trị viên có
    nút **“Vẫn tra cứu”** (gửi `?force=1`, chỉ ADMIN) hoặc dán lời thủ công; lời dán tay **luôn** được hiển thị.
    Luật phân loại nằm ở `src/lib/music/lyrics-auto.ts`.
  - **Kiểm tra ĐÚNG BÀI trước khi hiện** (nguyên tắc: _không hiện lời sai_ — thà báo “chưa tìm thấy” để quản
    trị viên dán tay): mỗi bản ghi tìm được phải khớp **tên bài** theo tập từ (bỏ các từ vô nghĩa như
    official/mv/audio/remix/live/cover vì các bản này dùng chung lời), so khớp **không phân biệt dấu tiếng Việt**;
    tên bài quá ngắn (1 từ) thì bắt buộc phải có thêm tín hiệu **nghệ sĩ** hoặc **thời lượng** mới nhận. Bản
    không đủ chắc chắn bị **bỏ qua** và ghi lại để báo cho quản trị viên biết lý do.
  - Trên bảng lời có **nhãn độ tin cậy**: _Quản trị viên dán_ · _Đúng bài_ (khớp cả tên + nghệ sĩ) ·
    _Khớp gần đúng_ (chỉ khớp tên bài — bản remix/cover/tên kênh, kèm dòng nhắc kiểm tra lại). Luật khớp nằm ở
    `src/lib/music/lyrics-match.ts`, `src/lib/music/lyrics-title.ts`.
  - Khách chưa đăng nhập **đọc** được lời của bài đã phát hành (như nghe nhạc), nhưng dán/xoá lời thì phải là
    quản trị viên (`POST`/`DELETE` đều qua `requireApiAdmin`).
  - Luật đọc file LRC nằm ở `src/lib/music/lyrics.ts` (nhiều mốc trên một dòng, `[offset:]`, tag meta, `mm:ss`
    thiếu phần trăm giây, `mm:ss:xx`) — kiểm chứng bằng `npm run check:lyrics` (có cả phần chạy trên CSDL thật
    và một lần tra cứu LRCLIB thật, mất mạng thì báo `SKIP`).
- **Chuyển bài luôn tự phát**: bấm Next hoặc hết bài thì bài kế tiếp tự động phát tiếp. Các sự kiện
  `pause` do chính thao tác đổi bài sinh ra (thay `src` của thẻ `<audio>`, tạm dừng động cơ khác khi
  đổi nguồn phát) đều bị bỏ qua, không còn bị hiểu nhầm thành “người dùng bấm tạm dừng”.
  Kiểm chứng bằng `npm run check:autoplay`.
- **SoundCloud**: sự kiện được đăng ký qua `SC.Widget.Events` (API chính thức, kèm tên sự kiện dự phòng)
  nên thanh thời gian luôn chạy; có thêm “đồng hồ dự phòng” hỏi `getPosition()` mỗi giây nếu widget
  không bắn `playProgress`; thời lượng lấy từ CSDL ngay khi nạp rồi cập nhật lại từ widget.
  Kiểm chứng bằng `npm run check:soundcloud`.

### Thiết bị đang đăng nhập (quản lý phiên theo từng máy)

Mở **Hồ sơ cá nhân** (`/music/profile`) → mục **“Thiết bị đang đăng nhập”**: mỗi máy đang dùng tài khoản
được hiện rõ **tên máy** (suy ra từ User-Agent: `Chrome 141 trên Windows`, `Safari 17 trên iPhone`…),
**IP**, **vị trí** (thành phố/quốc gia suy từ IP), **trình duyệt / hệ điều hành**, **đăng nhập lần đầu**,
**hoạt động gần nhất**, kèm nhãn `Thiết bị này` cho máy đang xem.

- **Đăng xuất** một thiết bị → phiên của máy đó hết hiệu lực ngay (máy đó phải đăng nhập lại).
- **Đăng xuất máy khác** → đóng mọi phiên khác nhưng giữ máy đang dùng.
- **Đăng xuất tất cả** → đóng cả máy đang dùng rồi đưa về trang đăng nhập.
- **Chặn đăng nhập** → cắt phiên hiện tại **và** không cho máy đó đăng nhập lại cho tới khi bấm
  **Mở chặn** (dùng khi mất điện thoại/máy là). Mở chặn **không** khôi phục phiên cũ — máy đó vẫn phải
  đăng nhập lại bằng mật khẩu.
- **Đổi tên** để đặt tên gợi nhớ (`Điện thoại của Hội`) thay cho tên tự động.
- Quản trị viên làm được điều tương tự cho **từng nhân viên**: `/admin/employees` → nút
  **Thiết bị đang đăng nhập** ở cuối mỗi dòng (xem IP/vị trí, đăng xuất hoặc chặn máy lạ).

Cách hoạt động: mỗi máy có cookie định danh `nch_device` (400 ngày, đặt tự động trong `proxy.ts` và
**không bị xoá khi đăng xuất**) ghép với User-Agent thành **khoá thiết bị** (`sha256`, `src/lib/device.ts`).
Khi đăng nhập, `authorize()` từ chối nếu khoá đó đang bị chặn, ngược lại ghi/cập nhật một dòng trong bảng
`user_devices` (IP, vị trí, tên máy) và nhét id thiết bị vào JWT. Mọi request sau đó được
`getActiveSessionUser()` đối chiếu lại: thiết bị đã bị đăng xuất từ xa hoặc bị chặn thì coi như **hết
phiên** (trang chuyển về `/login`, API trả **401**). Vị trí tra qua `ipapi.co` (không cần khoá, chờ tối đa
2.5 giây, tối đa 3 IP mỗi lần mở trang, nhớ tạm 6 giờ) — tra không được thì ghi “Không xác định được”,
**không làm chậm hay hỏng trang**. Trang đăng nhập gọi `/api/device-status` nên khi bị chặn sẽ báo **đúng
lý do** kèm tên máy, thay vì đổ lỗi cho mật khẩu. Kiểm chứng bằng `npm run check:devices` (có cả vòng đời
thật trên CSDL: tạo → chặn → mở chặn → đăng xuất, rồi tự xoá sạch dữ liệu thử).

> Nâng cấp: phiên tạo **trước** khi có tính năng này không kèm thông tin thiết bị nên sẽ phải **đăng nhập
> lại một lần** để được quản lý.

### Dành cho quản trị viên (ADMIN)

- **Dashboard (Tổng quan)**: 4 thẻ số liệu (tổng bài nhạc, tổng lượt nghe, người dùng, thời lượng nghe),
  biểu đồ lượt nghe 14 ngày, tỉ lệ theo nguồn phát, top bài hát, top thể loại, top nhân viên nghe nhiều,
  và 3 lối tắt sang thư viện nhạc / playlist nội bộ / lịch sử nghe.
  - Dùng lại component chung: `StatGrid` + `PanelHeader` + `QuickLink`
    (`src/components/admin/dashboard-cards.tsx`) và biểu đồ SVG thuần trong `src/components/admin/charts.tsx`.
  - **Trên điện thoại**: tiêu đề + mô tả xếp **dọc** rồi mới tới hai nút hành động full-width (trước đây để
    chung một hàng `justify-between` nên dòng mô tả dài bị đẩy xuống dưới nút và bị cắt); bốn thẻ số liệu chia
    **2 cột** (trước đây 1 cột làm trang dài và rất thưa); biểu đồ **co giãn theo bề rộng khung** nên không còn
    cuộn ngang, nhãn trục và điểm dữ liệu luôn đúng cỡ CSS pixel.
  - **Mọi thẻ nằm trong lưới đều có `min-w-0`**: `min-width: auto` của grid/flex item cộng với chuỗi `truncate`
    (nowrap) bên trong từng làm thẻ rộng 403px trong khi khung chỉ còn 358px → cả trang bị tràn ngang 29px.
    `npm run check:theme` và `npm run check:ui` khoá lại luật này.
- **Thư viện nhạc**: bảng danh sách, tìm kiếm, lọc theo nguồn, sửa thông tin, ẩn/hiện, xoá.
- **Thêm bài nhạc**:
  - Dán link YouTube / SoundCloud / TikTok → lấy metadata qua **oEmbed/API chính thức**.
  - Hoặc **tải file nhạc** lên (lưu vào local storage hoặc S3/MinIO).
- **Thể loại**: thêm/sửa/xoá, màu hiển thị, chặn xoá khi thể loại còn bài nhạc.
- **Playlist nội bộ**: tạo playlist dùng chung, thêm bài nhạc, gắn nhãn "Nội bộ" để hiện trên trang chủ.
- **Nhân viên**: tạo tài khoản, cấp/hạ quyền, khoá/mở khoá, đặt lại mật khẩu, xoá tài khoản.
- **Lịch sử toàn hệ thống**: xem lượt nghe của tất cả nhân viên.
- **Cài đặt hệ thống**: tên hệ thống, thông báo, giới hạn dung lượng upload, tắt/bật quyền tạo playlist.

### Xác nhận & thao tác hàng loạt (dùng thư viện UI)

- Mọi hộp thoại xác nhận dùng **Radix AlertDialog** (`@radix-ui/react-alert-dialog`) qua hook
  `useConfirm()`: có icon theo mức độ (nguy hiểm/cảnh báo), tiêu đề, mô tả, danh sách bản ghi bị ảnh hưởng,
  nút “Huỷ”/“Xoá” rõ ràng, hỗ trợ `Esc` và bàn phím — **không còn `window.confirm`** khó nhìn.
- **Tick chọn nhanh**: checkbox (Radix Checkbox) ở từng dòng + ô “Chọn tất cả” (trạng thái chọn một phần),
  kèm thanh hành động nổi hiển thị “Đã chọn N” với các nút thao tác một lần:
  - Ô đã tick dùng `data-[state=checked]:bg-gradient-brand` + dấu tích **trắng**, nên nhìn rõ ở **cả hai**
    giao diện; trạng thái chọn một phần dùng nền `bg-primary/25` + dấu `–` màu chủ đạo.
  - **Thư viện nhạc**: xoá đã chọn, ẩn đã chọn, phát hành đã chọn, **Xoá tất cả** thư viện.
  - **Playlist nội bộ**: xoá đã chọn, **Xoá tất cả**.
  - **Lịch sử nghe**: xoá đã chọn, **Xoá toàn bộ**.

### Chính sách nguồn nhạc (quan trọng)

Hệ thống **không bóc tách DRM, không tải xuống nội dung trái phép**. Mọi nội dung từ nền tảng ngoài
đều được **nhúng bằng trình phát chính thức**; metadata lấy từ oEmbed/API công khai. Khi nền tảng
không cho phép nhúng hoặc video bị giới hạn, hệ thống **báo lỗi rõ ràng** thay vì giả lập thành công.

### Cách lấy metadata từ SoundCloud (đã cập nhật)

SoundCloud **đã ngừng endpoint oEmbed** (`soundcloud.com/oembed` trả 404 từ 2026), nên hệ thống
dùng 2 tầng — **không bắt buộc phải có API key**:

1. **SoundCloud API chính thức** (`api.soundcloud.com/resolve`) — _tuỳ chọn_: nếu bạn cấu hình
   `SOUNDCLOUD_CLIENT_ID` thì metadata đầy đủ nhất (kèm tags). Đăng ký app miễn phí tại
   [developers.soundcloud.com](https://developers.soundcloud.com/) rồi dán Client ID vào `.env`.
2. **Không cần cấu hình gì (mặc định)**: hệ thống đọc thẻ meta Open Graph + dữ liệu hydration của trang
   bài nhạc → tên, nghệ sĩ, ảnh bìa, thể loại và **thời lượng chính xác (ms)**; sau đó trình duyệt tự gọi
   **SoundCloud Widget API chính thức** (`getCurrentSound`/`getDuration`) để xác nhận lại thời lượng, và
   trình phát gửi thời lượng thật về server ngay lần phát đầu. Nút
   **“Bổ sung thông tin từ SoundCloud”** trong trang thêm nhạc cho phép chạy lại bước này.

Nếu bài nhạc đã bị xoá/đặt riêng tư, hệ thống báo rõ:
_“Không tìm thấy bài nhạc này trên SoundCloud…”_ (đây là nguyên nhân phổ biến nhất khi trước đây
không lấy được nhạc). Bạn có thể kiểm tra nhanh một link cụ thể bằng `npm run metadata:check <url>`.

---

## 2. Yêu cầu hệ thống

| Thành phần   | Phiên bản đề xuất                                                                 |
| ------------ | --------------------------------------------------------------------------------- |
| Node.js      | ≥ 20.9 (khuyến nghị 22 hoặc 24)                                                   |
| npm          | ≥ 10                                                                              |
| PostgreSQL   | 15+ (khuyến nghị **Neon** hoặc Render Postgres; hoặc Docker `postgres:16-alpine`) |
| Hệ điều hành | Windows / Linux / macOS                                                           |

---

## 3. Cài đặt nhanh (môi trường local)

```bash
# 1) Cai dependencies
npm install

# 2) Tao file .env tu mau va chinh sua
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux

# 3) Sinh Prisma Client + tao bang + nap du lieu mau
npm run db:generate
npm run db:migrate          # tao migration va ap dung
npm run db:seed             # du lieu mau + tai khoan demo

# 4) Chay dev server
npm run dev                 # http://localhost:3000
```

---

## 4. Cấu hình `.env`

```ini
# --- Database: PostgreSQL (Neon / Render Postgres) ---
# Lay chuoi ket noi o Neon: Project -> Connection string -> chon "Pooled connection" (co "-pooler").
# KHONG dat mat khau that vao README / .env.example vi day la file trong repo cong khai.
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# --- Auth.js (NextAuth v5) ---
AUTH_SECRET="<chuoi-ngau-nhien-64-ky-tu>"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"

# --- Storage cho file upload: local | s3 ---
STORAGE_DRIVER="local"
STORAGE_LOCAL_DIR=".data/uploads"
STORAGE_PUBLIC_PREFIX="/api/files"
UPLOAD_MAX_BYTES="52428800"
S3_ENDPOINT=""
S3_REGION=""
S3_BUCKET=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_PUBLIC_BASE_URL=""

# --- Metadata adapters ---
YOUTUBE_API_KEY=""            # tuy chon: lay them thoi luong video YouTube
METADATA_TIMEOUT_MS="8000"

NEXT_PUBLIC_APP_NAME="NhacCuaHoiKS"
```

> Prisma 7 **không tự nạp file `.env`** cho CLI. Dự án đã xử lý bằng
> `import "dotenv/config"` ở đầu `prisma.config.ts` (không cần làm gì thêm).

### Tạo database PostgreSQL trên Neon

1. Đăng nhập [neon.tech](https://neon.tech) → **New Project** (chọn region gần Việt Nam, ví dụ _Singapore_).
2. Mở **Connection string** → chọn **Pooled connection** → sao chép chuỗi dạng
   `postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Dán vào `DATABASE_URL` trong `.env`, rồi chạy:

```bash
npm run db:deploy    # tao bang theo prisma/migrations (baseline PostgreSQL)
npm run db:seed      # du lieu mau (tuy chon)
npm run db:check     # kiem tra ket noi + liet ke bang + dem user
```

> **Bảo mật:** repo này là công khai nên mọi mật khẩu trong README/`.env.example`/`docker-compose.yml`
> đều chỉ là **giá trị mẫu**. Mật khẩu thật chỉ nằm trong `.env` (đã bị `.gitignore` chặn) hoặc trong
> biến môi trường khi triển khai. Lưu ý `npm run env:write` **giữ nguyên `DATABASE_URL` đang có** trong
> `.env`; muốn đổi CSDL thì truyền `NEW_DATABASE_URL` hoặc sửa tay file `.env`.

- Neon có **branch** giống Git: nên tạo một branch riêng cho dev để thử nghiệm mà không đụng dữ liệu thật.
- Không cần quyền `sa`/quyền tạo database: tài khoản Neon đã là chủ database của project đó.
- **Nên chọn region gần Việt Nam (Singapore)**: đo thực tế với project ở `us-east-2` (Ohio) cho độ trễ
  mỗi truy vấn ~250–280ms; đổi sang Singapore sẽ nhanh hơn nhiều lần.
- **Chuỗi pooled vs direct**: chuỗi **pooled** (`-pooler`, PgBouncer) dùng cho **ứng dụng lúc chạy**
  (nhiều request dùng chung kết nối). Còn **mọi lệnh migrate** (`prisma migrate deploy` trong Dockerfile /
  Render, `npm run db:deploy`) phải đi qua chuỗi **direct** (bỏ `-pooler` khỏi host):
  PgBouncer làm `pg_advisory_lock` của Prisma bị treo →
  `Error: P1002 - Timed out trying to acquire a postgres advisory lock`, và lock còn có thể bị giữ lại
  trên một backend trong pool làm **deploy sau cũng chết**. Vì vậy:
  - Đặt `DIRECT_URL` trong `.env` (và trong Render → _Environment_) là chuỗi **không** có `-pooler`;
  - `prisma.config.ts` ưu tiên `DIRECT_URL`; `Dockerfile`/`render.yaml` cũng tự bỏ `-pooler` khỏi
    `DATABASE_URL` nếu thiếu `DIRECT_URL` — nên không đặt vẫn chạy, chỉ là kém tường minh.
  - `prisma migrate dev` khi phát triển schema cũng nên dùng chuỗi direct (PgBouncer không hỗ trợ đầy
    đủ các thao tác shadow database).

---

## 5. Tài khoản mẫu (sau khi `npm run db:seed`)

> **Không chạy seed?** CSDL trắng sẽ **không có tài khoản nào** — hãy tạo riêng một tài khoản quản trị:
>
> ```bash
> npm run admin:create -- --email ban@congty.vn --password "MatKhauManh@2026" --name "Tên bạn"
> ```
>
> Thêm `--dry-run` để kiểm tra tham số (email hợp lệ, mật khẩu ≥ 8 ký tự) mà không ghi vào CSDL.
>
> **Đã seed rồi mà muốn xoá dữ liệu mẫu (giữ tài khoản)?** `prisma migrate reset` của Prisma 7
> **không có cờ `--skip-seed`** (chạy vào là nó báo lỗi trợ giúp; nếu chạy được thì nó seed lại dữ liệu).
> Cách đúng là xoá bằng SQL:
>
> ```bash
> npm run db:wipe-sample
> # hoac: npx prisma db execute --file scripts/wipe-sample-data.sql
> ```
>
> (file này TRUNCATE toàn bộ bảng nghiệp vụ và xoá 3 tài khoản mẫu, giữ lại tài khoản quản trị thật).

| Vai trò       | Email                    | Mật khẩu          |
| ------------- | ------------------------ | ----------------- |
| Quản trị viên | `admin@mymusic.local`    | `Admin@123456`    |
| Nhân viên     | `nhanvien@mymusic.local` | `NhanVien@123456` |
| Nhân viên     | `thuha@mymusic.local`    | `NhanVien@123456` |

> **Đây là tài khoản MẪU cho môi trường thử nghiệm.** Khi dùng thật, hãy đổi mật khẩu (Hồ sơ cá nhân →
> Đổi mật khẩu) hoặc seed bằng biến môi trường `SEED_ADMIN_PASSWORD` / `SEED_EMPLOYEE_PASSWORD`.
> Trên bản build production, gợi ý tài khoản mẫu **không** còn hiện ở màn hình đăng nhập.

Seed tạo kèm: 5 thể loại, ~24 bài nhạc (YouTube/SoundCloud/file demo), 4 playlist,
~60–90 lượt nghe trong 14 ngày để dashboard có số liệu thực tế.

---

## 6. Cấu trúc thư mục

```
prisma/
  schema.prisma            # 8 model: User, Genre, Song, Playlist, PlaylistSong,
                           #          Favorite, ListenHistory, AppSetting
  seed.ts                  # du lieu mau
prisma.config.ts           # cau hinh Prisma CLI (Prisma 7)
src/
  app/
    (auth) login/          # dang nhap
    music/                 # khu vuc nhan vien (layout rieng + player)
    admin/                 # khu vuc quan tri
    api/                   # REST API (route handlers)
  components/
    admin/                 # bang quan tri, bieu do, form
    auth/                  # form dang nhap, ho so
    layout/                # sidebar, topbar
    music/                 # song-row, song-card, playlist, history...
    player/                # player-engine + engines/{youtube,soundcloud,tiktok,audio}
    ui/                    # bo UI primitives kieu shadcn
  lib/
    api/                   # chuan hoa response + loi nghiep vu
    auth/                  # hash mat khau + guard phan quyen
    db/                    # PrismaClient (driver adapter `pg` cho PostgreSQL)
    music/                 # adapter metadata (oEmbed/API chinh thuc)
    storage/               # local + S3/MinIO
    validations/           # schema Zod
    nav.ts                 # cau hinh menu dung chung (sidebar, menu mobile, tieu de header)
  proxy.ts                 # proxy (thay cho middleware.ts o Next.js 16)
  services/                # tang nghiep vu truy van CSDL
  store/                   # zustand player store
  types/                   # kieu du lieu dung chung + mo rong NextAuth
```

---

## 7. API chính

| Method          | Endpoint                           | Quyền                                                     | Mô tả                                                   |
| --------------- | ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| GET             | `/api/health`                      | public                                                    | Kiểm tra kết nối CSDL (dùng cho Docker healthcheck)     |
| GET             | `/api/files/*`                     | public                                                    | Phục vụ file nhạc/ảnh trong storage (HTTP Range để tua) |
| POST            | `/api/metadata`                    | ADMIN                                                     | Lấy metadata từ YouTube/SoundCloud/TikTok               |
| POST            | `/api/upload`                      | ADMIN                                                     | Tải file nhạc/ảnh lên storage                           |
| GET             | `/api/songs`                       | public (khách cũng xem được)                              | Danh sách bài nhạc đã xuất bản                          |
| POST            | `/api/songs`                       | ADMIN                                                     | Thêm bài nhạc                                           |
| GET             | `/api/songs/:id`                   | public                                                    | Chi tiết bài nhạc (khách chỉ thấy bài đã xuất bản)      |
| PATCH/DELETE    | `/api/songs/:id`                   | ADMIN                                                     | Cập nhật, xoá bài nhạc                                  |
| POST            | `/api/songs/:id/duration`          | public                                                    | Cập nhật thời lượng khi trình phát báo về               |
| POST            | `/api/songs/:id/favorite`          | user                                                      | Bật/tắt yêu thích                                       |
| GET             | `/api/favorites`                   | user                                                      | Danh sách bài nhạc yêu thích                            |
| GET/POST/DELETE | `/api/history`                     | user                                                      | Lịch sử nghe / ghi nhận lượt nghe / xoá toàn bộ         |
| DELETE          | `/api/history/:id`                 | user                                                      | Xoá một mục lịch sử                                     |
| GET             | `/api/genres`                      | public                                                    | Danh sách thể loại                                      |
| POST            | `/api/genres`                      | ADMIN                                                     | Thêm thể loại                                           |
| PATCH/DELETE    | `/api/genres/:id`                  | ADMIN                                                     | Sửa / xoá thể loại                                      |
| GET             | `/api/playlists`                   | public (khách chỉ thấy playlist công khai)                | Playlist của tôi + playlist công khai                   |
| POST            | `/api/playlists`                   | user                                                      | Tạo playlist                                            |
| GET             | `/api/playlists/:id`               | public nếu playlist công khai, ngược lại chủ sở hữu/ADMIN | Chi tiết playlist                                       |
| PATCH/DELETE    | `/api/playlists/:id`               | chủ sở hữu hoặc ADMIN                                     | Sửa / xoá                                               |
| POST/PUT        | `/api/playlists/:id/songs`         | chủ sở hữu                                                | Thêm bài / sắp xếp lại                                  |
| DELETE          | `/api/playlists/:id/songs/:songId` | chủ sở hữu                                                | Xoá bài khỏi playlist                                   |
| GET/PATCH       | `/api/me`                          | user                                                      | Thông tin / cập nhật hồ sơ                              |
| POST            | `/api/me/password`                 | user                                                      | Đổi mật khẩu                                            |
| GET/POST        | `/api/employees`                   | ADMIN                                                     | Danh sách / tạo nhân viên                               |
| PATCH/DELETE    | `/api/employees/:id`               | ADMIN                                                     | Cập nhật vai trò, trạng thái / xoá                      |
| POST            | `/api/employees/:id/password`      | ADMIN                                                     | Đặt lại mật khẩu                                        |
| GET/PUT         | `/api/admin/settings`              | ADMIN                                                     | Đọc / ghi cấu hình hệ thống                             |
| GET             | `/api/admin/stats`                 | ADMIN                                                     | Số liệu dashboard                                       |
| GET             | `/api/search?q=`                   | public                                                    | Tìm kiếm nhanh                                          |
| POST            | `/api/songs/bulk`                  | ADMIN                                                     | Xoá / ẩn / phát hành nhiều bài nhạc cùng lúc            |
| POST            | `/api/playlists/bulk`              | chủ sở hữu hoặc ADMIN                                     | Xoá nhiều playlist cùng lúc                             |
| POST            | `/api/history/bulk`                | user                                                      | Xoá nhiều mục trong lịch sử nghe của mình               |

---

## 8. Bảo mật

- **Phân quyền 2 lớp**: `proxy.ts` chặn theo vai trò ở tầng request, các trang server và route handler
  kiểm tra lại quyền (defense in depth). Nhân viên không thể gọi API quản trị.
- **Phạm vi truy cập của khách**: chỉ các endpoint _đọc_ cần thiết để nghe nhạc và các trang công khai
  (`/music`, `/music/discover`, `/music/search`, `/login`) được mở; mọi API cá nhân/quản trị trả **401**,
  các trang cá nhân chuyển hướng về `/login`. Playlist riêng tư trả **403** với khách.
- **Mật khẩu** hash bằng bcrypt (12 rounds); đổi mật khẩu yêu cầu xác thực mật khẩu hiện tại.
- **Tài khoản bị khoá** không thể đăng nhập và không thể thao tác dù session còn hiệu lực
  (`requireApiUser` xác thực lại với CSDL).
- **Quản lý thiết bị**: mỗi phiên gắn với một thiết bị (cookie định danh `nch_device` + User-Agent,
  băm `sha256`). Có thể **đăng xuất từ xa** từng thiết bị hoặc **chặn đăng nhập** một thiết bị (kể cả sau
  khi đã đăng xuất, vì cookie định danh không bị xoá) — máy bị chặn chỉ vào được sau khi quản trị viên
  **mở chặn**. Mọi request đều đối chiếu lại trạng thái thiết bị nên việc cắt phiên có hiệu lực ngay.
  Xem `src/services/device.service.ts`, `src/lib/auth/guards.ts`, `npm run check:devices`.
- **Chống SSRF**: endpoint `/api/metadata` chỉ cho phép danh sách tên miền hợp lệ
  (`youtube.com`, `youtu.be`, `soundcloud.com`, `tiktok.com`), chặn protocol khác và kiểm tra lại
  tên miền sau khi redirect.
- **Path traversal**: thư mục upload chỉ được phục vụ qua `/api/files/*` sau khi chuẩn hoá đường dẫn
  và kiểm tra nằm trong `STORAGE_LOCAL_DIR`.
- **Rate limit**: giới hạn tần suất gọi metadata và upload theo người dùng.
- **Validate dữ liệu** bằng Zod ở mọi endpoint ghi; lỗi được trả về theo từng trường.
- **Ràng buộc nghiệp vụ**: không thể tự khoá/hạ quyền chính mình, luôn còn ít nhất 1 ADMIN hoạt động.
- **Header bảo mật** khai báo trong `next.config.ts` (X-Content-Type-Options, Referrer-Policy,
  X-Frame-Options, Permissions-Policy).
- **Không lưu mật khẩu/nội dung nhạy cảm** vào log; lỗi hệ thống được chuẩn hoá trước khi trả về client.

---

## 9. Triển khai

### 9.1. Render + Neon (khuyến nghị)

Repo đã có sẵn **`render.yaml`** (Render Blueprint) nên các bước chỉ còn là tạo CSDL và bấm deploy:

1. **Tạo database trên Neon**: đăng nhập [neon.tech](https://neon.tech) → _New Project_ (chọn region gần
   Việt Nam, ví dụ _Singapore_) → mở **Connection string**, chọn **Pooled connection** → sao chép chuỗi
   `postgresql://...@ep-xxx-pooler....neon.tech/neondb?sslmode=require`.
2. **Tạo web service trên Render**: _New +_ → **Blueprint** → chọn repo này → Render đọc `render.yaml` và
   hỏi 2 biến (2 biến còn lại tự sinh/nội bộ):
   - `DATABASE_URL` = chuỗi Neon vừa sao chép
   - `AUTH_URL` = `https://<tên-dịch-vụ>.onrender.com` (đổi lại sau khi gắn tên miền riêng)
3. Bấm **Apply**. Build tự chạy: `npm ci` → `prisma generate` → **`prisma migrate deploy`** (tạo bảng trên
   Neon) → `next build`; sau đó `next start`. Health check dùng `/api/health`.

   > **Migration lúc khởi động container**: `Dockerfile` **không** chạy `prisma migrate deploy` trực tiếp mà
   > gọi `scripts/docker-start.cjs`, script này: (1) **gỡ “advisory lock” còn treo** trên Neon, (2) migrate qua
   > kết nối **trực tiếp** (bỏ `-pooler`) và **thử lại 4 lần**. Lý do: `pg_advisory_lock` của Prisma
   > (a) treo khi đi qua pooler và (b) hai deploy chạy **song song** rất dễ tranh nhau đúng cái lock đó →
   > `Error: P1002`. Nếu vẫn không migrate được, ứng dụng **vẫn khởi động** (migration đã được áp dụng trước
   > khi phát hành) và ghi cảnh báo vào log — web không sập vì lỗi tạm thời của lock.
   > **Đừng bấm _Manual Deploy_ liên tục khi đang có deploy chạy** — mỗi lần bấm là thêm một container cùng
   > tranh lock. Cấu hình này được canh tự động bằng `npm run check:deploy`.
4. **Tạo tài khoản đăng nhập** — chọn một trong hai (chạy ở Render → service → tab _Shell_):
   - **Có dữ liệu mẫu**: `npm run db:seed` → tạo admin `admin@mymusic.local / Admin@123456` + ~24 bài.
   - **Thư viện trắng, tự thêm bài sau**: `npm run admin:create -- --email ban@congty.vn --password "MatKhauManh@2026" --name "Tên bạn"`
     — **bắt buộc** làm bước này nếu không seed, vì CSDL trắng thì không có tài khoản nào để đăng nhập.
5. **Gắn tên miền riêng**: Render → service → _Settings → Custom Domains_ → nhập `nhac.congty.vn`, rồi tạo
   bản ghi DNS **CNAME** `nhac` → `<tên-dịch-vụ>.onrender.com` (dùng domain gốc thì thêm bản ghi `A`).
   Render tự cấp HTTPS. **Sau khi đổi tên miền phải cập nhật `AUTH_URL=https://nhac.congty.vn`** rồi
   deploy lại — sai `AUTH_URL` là cookie đăng nhập gắn nhầm tên miền và người dùng bị đá ra liên tục.

Lưu ý của gói miễn phí (đã tính sẵn trong thiết kế):

- Render free **ngủ sau ~15 phút** không có truy cập → lần mở đầu chậm 30–60 giây; `/api/health` là điểm
  để dịch vụ ping giữ ấm nếu bạn cần.
- **Ổ đĩa là tạm thời**: bật `STORAGE_DRIVER=local` thì bài tải lên sẽ **mất mỗi lần deploy**. Muốn giữ
  file: đặt `STORAGE_DRIVER=s3` + các biến `S3_*` (Cloudflare R2 / MinIO / AWS S3 — driver đã có sẵn trong
  `src/lib/storage/s3.ts`), hoặc gắn **Render Disk** (chỉ có ở gói trả phí).
- Neon free tự "ngủ" khi không dùng → request đầu tiên có thể chậm thêm ~1 giây. Nên tạo **một branch**
  riêng cho dev trên cùng project Neon để dev/prod tách dữ liệu mà vẫn một chỗ quản lý.

### 9.2. Docker (self-host)

```bash
# Chay ung dung (CSDL la Neon: dien DATABASE_URL trong .env)
docker compose up -d --build

# Xem log
docker compose logs -f app

# Nap du lieu mau trong container
docker compose exec app npx prisma db seed
```

Biến `DATABASE_URL` và `AUTH_SECRET` **bắt buộc** đặt qua file `.env` (hoặc biến môi trường khi deploy);
`docker-compose.yml` cố ý **không dùng giá trị mặc định** — thiếu biến là compose báo lỗi và dừng ngay.
Muốn chạy PostgreSQL ngay trên máy thay vì Neon thì bỏ comment service `postgres` trong
`docker-compose.yml` và khai báo `POSTGRES_USER` / `POSTGRES_PASSWORD` trong `.env`.

Build production không dùng Docker (self-host):

```bash
npm ci
npm run db:generate
npm run build
NODE_ENV=production npm start
```

---

## 10. Kiểm thử & kiểm tra chất lượng

```bash
npm run typecheck     # TypeScript nghiem ngat, khong emit
npm run lint          # ESLint (eslint-config-next)
npm run build         # Build production (Next.js 16 + Turbopack)
npm run db:studio     # Xem du lieu bang Prisma Studio
npm run db:check      # Kiem tra ket noi PostgreSQL + liet ke bang + dem user
npm run admin:create  # Tao tai khoan quan tri (khong can seed) - them --dry-run de kiem tra tham so
npm run env:write     # Sinh lai file .env chuan (AUTH_SECRET ngau nhien)
npm run smoke         # Smoke test API (chay khi server dang bat)
                      # LUU Y: mac dinh dang nhap bang tai khoan mau cua seed; neu khong seed thi dat
                      #   $env:SMOKE_EMAIL / $env:SMOKE_PASSWORD (PowerShell) truoc khi chay
npm run bench         # Do toc do cac trang chinh (chay khi server dang bat)
npm run verify        # Build + start server + smoke test tu dong (Windows)
npm run check:guest   # Kiem tra quyen cua khach (chay khi server dang bat)
npm run check:guest:serve   # Start server + kiem tra quyen cua khach tu dong
npm run check:ui:serve      # Start server + kiem tra menu mobile & header desktop
                           # (can du lieu mau: chay `npm run db:seed` neu DB trong hoac da xoa playlist noi bo)
npm run check:nav    # Test logic menu + tieu de trang (khong can server)
npm run check:autoplay  # Test tu dong phat bai ke tiep khi chuyen bai / het bai
npm run check:soundcloud  # Test dong co SoundCloud (thoi gian chay, thoi luong, su kien)
npm run check:duration  # Test lay dung thoi luong (YouTube/SoundCloud) va tu sua so sai
npm run check:dialogs  # Test hop thoai xac nhan (thu vien) + tick chon xoa hang loat
npm run check:volume  # Test am luong 0-200% va khuech dai lon hon ban goc
npm run check:seek    # Test thanh thoi gian: keo-tha, khong nhay nguoc, gioi han vi tri tua
npm run check:sleep   # Test hen gio tat nhac (dem nguoc theo phut + tat sau N bai, khong luu khi tai lai)
npm run check:video   # Test video toan man hinh cuon theo noi dung (khong dung yen, khong de len header)
npm run check:theme   # Test bang mau 2 giao dien (du token, tuong phan WCAG, het mau le)
npm run check:history # Test luong ghi lich su nghe (khong spam request, chi ghi khi co tien trien)
npm run check:recent  # Test muc "Nghe tiep" khong lap lai mot bai nhieu lan
npm run check:mix     # Test "Mix quanh bai nay" (cham diem tuong dong, xep hang on dinh, mix that tren CSDL)
npm run check:insights # Test "Nhip nghe" (ngay/gio dia phuong, chuoi ngay lien tiep, thong ke that tren CSDL)
npm run check:shortcuts # Test phim tat trinh phat (phim -> hanh dong, bo qua khi dang go/giu Ctrl/mo hop thoai)
npm run check:lyrics  # Test loi bai hat (doc LRC, dong dang hat, cache CSDL, tra cuu LRCLIB that)
npm run check:thumbs  # Test anh bia net (nang cap maxresdefault/t500x500, tu ha cap khi anh loi)
npm run check:resume  # Test "Nghe tiep tu cho dung" (nguong nho, buoc 5 giay, chay tren store that)
npm run check:media   # Test Media Session (thong tin + anh bia net, nut tren man hinh khoa, thanh thoi gian)
npm run check:search  # Test tim kiem khong phan biet hoa/thuong (PostgreSQL) + email dang nhap
npm run check:mobile  # Test quy tac giao dien dien thoai (chong zoom khi focus o nhap, khong chan pinch-zoom)
npm run check:youtube # Test dong co YouTube (khong can server, khong can trinh duyet)
```

Kết quả `npm run verify` mong đợi:

```
BUILD_EXIT=0
health | 200 | ok | NhacCuaHoi | latency ...
login | 302 | redirect: http://localhost:3000/ | cookies: authjs.csrf-token, authjs.session-token
session | admin@mymusic.local | role ADMIN
songs(auth) | 200 | total 29 | items 3
stats(admin) | 200 | songs 29 | plays 85 | listeners 3
admin page | 200 | co bang dieu khien: true
songs(unauth) | 200        # khach van doc duoc danh sach bai nhac
stats(unauth) | 401
```

Kết quả `npm run check:guest:serve` mong đợi (29 kiểm tra):

```
PASS | Trang goc -> /music cho khach | / -> 307 /music
PASS | GET /music -> 200 | loi chao khach: true | co nut dang nhap: true
PASS | Trang ca nhan chuyen huong ve /login | /music/favorites -> 307 /login?callbackUrl=...
PASS | GET /api/songs (khach) -> 200 | total 29
PASS | GET /api/playlists (khach) -> 200 | chi gom cong khai: true
PASS | API ca nhan chan khach | /api/favorites -> 401
PASS | GET /api/playlists/:id (playlist rieng tu) -> 403
TONG KET: 29 PASS / 0 FAIL
```

Kiểm tra nhanh bằng tay sau khi chạy dev (`npm run dev`):

1. `http://localhost:3000/api/health` → `{"status":"ok","database":"connected"}`.
2. Đăng nhập `admin@mymusic.local` → vào `/admin`, xem dashboard có số liệu.
3. Vào `/admin/music/new`, dán link YouTube → bấm **Lấy thông tin** → lưu.
4. Vào `/music`, bấm phát một bài, chuyển trang và kiểm tra nhạc vẫn phát (player toàn cục).
5. Bấm trái tim, tạo playlist, kiểm tra `/music/history` ghi nhận lượt nghe.

---

## 11. Xử lý sự cố

| Hiện tượng                                                           | Nguyên nhân thường gặp                                                                  | Cách xử lý                                                                                                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Thiếu biến môi trường DATABASE_URL`                                 | Chưa tạo `.env`                                                                         | Sao chép `.env.example` → `.env` rồi dán chuỗi kết nối Neon                                                                                             |
| `ECONNREFUSED` / timeout khi kết nối CSDL                            | Sai host/port, mạng chặn 5432, hoặc Neon đang "ngủ"                                     | Kiểm tra chuỗi kết nối (phải có `-pooler` và `sslmode=require`), rồi chạy `npm run db:check`                                                            |
| `password authentication failed`                                     | Sai mật khẩu trong `DATABASE_URL`                                                       | Neon → _Reset password_ → dán lại chuỗi mới vào `.env` (lưu ý `npm run env:write` giữ nguyên `DATABASE_URL` cũ)                                         |
| `SSL required` / `no pg_hba.conf entry`                              | Thiếu `?sslmode=require`                                                                | Thêm `?sslmode=require` vào cuối `DATABASE_URL`                                                                                                         |
| `Error: P1002 ... postgres advisory lock` khi deploy                 | `prisma migrate deploy` chạy qua chuỗi **pooled** (`-pooler`) của Neon                   | Đặt `DIRECT_URL` = chuỗi **không** có `-pooler` (Render → _Environment_); `Dockerfile`/`render.yaml` đã tự bỏ `-pooler` để dự phòng. Nếu lock đang bị giữ: `select pg_terminate_backend(pid) from pg_locks where locktype='advisory' and granted;` |
| Tìm kiếm gõ đúng mà không ra bài                                     | Thiếu `mode: "insensitive"` — PostgreSQL phân biệt hoa/thường                           | Giữ `mode: "insensitive"` ở `song.service.ts` / `song-discovery.service.ts` (xem mục 12)                                                                |
| Bài tải lên biến mất sau khi deploy Render                           | Ổ đĩa của gói free là tạm thời                                                          | Chuyển `STORAGE_DRIVER=s3` (+ các biến `S3_*`) hoặc gắn Render Disk                                                                                     |
| Đăng nhập chạy ở localhost nhưng lỗi trên tên miền                   | `AUTH_URL` chưa khớp tên miền thật                                                      | Đặt `AUTH_URL=https://<tên miền>`, `AUTH_USE_SECURE_COOKIES=true` rồi deploy lại                                                                        |
| Không lấy được metadata YouTube                                      | Video bị giới hạn/không tồn tại                                                         | Nhập tay thông tin bài nhạc; kiểm tra mạng và host allowlist                                                                                            |
| SoundCloud báo _“Không tìm thấy bài nhạc này”_                       | Link đã bị xoá / đổi đường dẫn / đặt riêng tư                                           | Dán lại link từ trang SoundCloud đang mở được; kiểm tra bằng `npm run metadata:check <url>`                                                             |
| SoundCloud thiếu thời lượng                                          | Chưa có thời lượng trong dữ liệu công khai                                              | Bấm **“Bổ sung thông tin từ SoundCloud”**, hoặc để hệ thống tự cập nhật khi phát lần đầu (thời lượng thật do Widget API báo về). **Không cần API key.** |
| Cảnh báo _hydration mismatch_ với `cz-shortcut-listen` trên `<body>` | Extension trình duyệt (ColorZilla…) tự thêm thuộc tính vào HTML trước khi React hydrate | Đã bỏ qua bằng `suppressHydrationWarning` ở `<body>`; đây không phải lỗi ứng dụng                                                                       |
| Nút play không phát nhạc                                             | Trình duyệt chặn autoplay                                                               | Bấm play trực tiếp trên giao diện (thao tác người dùng thật)                                                                                            |
| TikTok không đổi được âm lượng                                       | Giới hạn của TikTok Embed Player                                                        | Dùng nút tắt/bật tiếng; hệ thống hiển thị ghi chú tương ứng                                                                                             |
| File upload không phát được                                          | File vượt giới hạn hoặc sai định dạng                                                   | Kiểm tra `UPLOAD_MAX_BYTES` và định dạng cho phép                                                                                                       |

---

## 12. Ghi chú kỹ thuật

- **Thư viện UI**: các primitive dùng Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`,
  `@radix-ui/react-checkbox`, `@radix-ui/react-dropdown-menu`...) bọc lại trong `src/components/ui/*`.
  Hộp thoại xác nhận là `useConfirm()` (Promise) dùng chung toàn app; thao tác hàng loạt dùng
  `useRowSelection()` + `<BulkActionBar />` + `<Checkbox />`.
- **“Nghe tiếp” trên trang chủ**: bảng `listen_history` lưu _mỗi lượt nghe là một dòng_, nên hàm
  `listRecentlyPlayedSongs()` quét một khoảng lịch sử gần đây rồi lọc trùng theo bài
  (`pickUniqueRecentSongs`) — mỗi bài xuất hiện một lần, theo thứ tự nghe mới nhất.
  Trang `/music/history` thì vẫn liệt kê **từng lượt nghe** kèm thời gian (đúng bản chất nhật ký).
- **Đếm bài nổi bật trên banner**: “Mới thêm vào thư viện” và “Nghe nhiều nhất” là hai truy vấn độc lập
  nên một bài có thể xuất hiện ở cả hai; `countUniqueSongs()` (ở `src/lib/music/collections.ts`) gộp
  theo `id` trước khi hiển thị, tránh con số bị đếm trùng. Kiểm chứng bằng `npm run check:recent`.

- **Next.js 16**: `middleware.ts` đã được đổi tên thành `proxy.ts`; dự án dùng `proxy.ts`
  (`src/proxy.ts`) để gác quyền truy cập.
- **Prisma 7 + PostgreSQL (Neon)**: driver adapter `@prisma/adapter-pg` (thuần JavaScript, không cần Rust
  engine) dùng chuỗi `postgresql://` chuẩn; client khởi tạo ở `src/lib/db/prisma.ts` với pool `max: 5`
  để không vượt hạn mức kết nối của Neon free (nên dùng chuỗi **pooled** của Neon).
- **Vì sao không dùng enum/Json/scalar list**: các trường `role`, `sourceType`, `playbackType` dùng
  `String` + union type TypeScript (`ADMIN | EMPLOYEE`, `YOUTUBE | SOUNDCLOUD | TIKTOK | UPLOADED`) và
  validate bằng Zod; `tags` lưu CSV. Thiết kế này giữ nguyên từ bản SQL Server nên **tầng nghiệp vụ không
  phải sửa** khi đổi CSDL.
- **PostgreSQL PHÂN BIỆT hoa/thường** (SQL Server thì không): mọi truy vấn `contains` phải kèm
  `mode: "insensitive"` (xem `src/services/song.service.ts`, `src/services/song-discovery.service.ts`),
  còn email đăng nhập đã được `toLowerCase()` trước khi tra cứu (`src/auth.ts`,
  `src/services/user.service.ts`).
- **Native type**: chuỗi có giới hạn dùng `@db.VarChar(n)`, nội dung dài dùng `@db.Text`
  (trước đây là `@db.NVarChar(n)` / `@db.NVarChar(Max)` của SQL Server).
- **Chuyển CSDL**: dự án đã chuyển từ SQL Server sang PostgreSQL; `prisma/migrations` nay chỉ còn baseline
  `20260928100000_init_postgres` tạo toàn bộ bảng/index/khoá ngoại từ đầu.
- **Thời lượng bài hát — luôn lấy đúng, không cần API key**:
  - YouTube: đọc `lengthSeconds` từ trang xem video (không cần key); nếu có `YOUTUBE_API_KEY` thì dùng
    Data API v3 chính xác hơn. Khi phát, IFrame Player API báo lại thời lượng thật.
  - SoundCloud: đọc thời lượng (ms) từ dữ liệu hydration của trang bài nhạc; khi phát, Widget API
    (`getDuration`) báo lại con số thật.
  - File tải lên: lấy từ thẻ `<audio>` (`duration`).
  - TikTok: hệ thống cập nhật sau khi trình phát báo về (không hiển thị số liệu giả).
  - **Tự sửa số sai**: nếu CSDL đang lưu thời lượng lệch quá 3 giây so với con số thật do nền tảng báo về
    thì server tự ghi đè (`/api/songs/:id/duration` → `syncDuration`), nên thanh thời gian luôn khớp.
    Kiểm chứng bằng `npm run check:duration`.
- **Metadata SoundCloud**: oEmbed của SoundCloud đã ngừng hoạt động (404), nên adapter dùng
  API chính thức khi có `SOUNDCLOUD_CLIENT_ID`, nếu không thì đọc thông tin công khai của trang bài
  nhạc và bổ sung bằng SoundCloud Widget API (`getCurrentSound`) ngay trên trình duyệt quản trị.
- **Dữ liệu mẫu SoundCloud**: 6 bài trong seed đã được kiểm chứng còn hoạt động (dùng
  `npm run metadata:check <url>` để kiểm tra lại từng link).
  Một số bản nhạc trên SoundCloud có thời lượng 30 giây (bản xem trước) — đây là giới hạn của chính
  chủ sở hữu bản quyền, hệ thống hiển thị đúng như nền tảng trả về.

### Tối ưu tốc độ tải trang

Sau khi đo (`npm run bench`), nút thắt là **số lượt truy vấn CSDL cho mỗi trang** (mỗi lượt ~25–30ms trên
SQL Server cũ; PostgreSQL/Neon thường 5–15ms), nên các tối ưu tập trung vào việc giảm số lượt và giữ kết nối
luôn ấm:

- **Yêu thích dùng chung một truy vấn/request**: `getFavoriteIdSet()` được cache bằng React `cache()` —
  trước đây mỗi danh sách (nhạc mới, nghe nhiều, nghe tiếp…) tự truy vấn favorites riêng.
- **Session giải mã một lần/request**: `getSessionUser()` bọc `cache()` vì layout gốc + layout khu + trang
  đều gọi hàm này.
- **Dashboard quản trị**: gộp truy vấn “top người nghe” vào `Promise.all` và tính tổng bằng `groupBy`
  (`_sum.msPlayed`) ngay trên CSDL thay vì kéo toàn bộ lịch sử của người dùng về Node.
- **Pool kết nối**: `max: 5` + `idleTimeoutMillis: 30s` trong `src/lib/db/prisma.ts` → giữ kết nối ấm mà
  vẫn nằm trong hạn mức của Neon free; nên dùng chuỗi **pooled** của Neon để nhiều tiến trình dùng chung.
- **Khung xương khi chuyển trang**: `src/app/music/loading.tsx` và `src/app/admin/loading.tsx`
  (`<PageSkeleton />`) hiện ngay lập tức trong lúc server lấy dữ liệu.
- **Trang chủ gọn hơn**: 8 bài mới + 6 bài nghe nhiều + 4 playlist nổi bật (giảm dung lượng HTML/RSC).
- **Lịch sử nghe không còn bắn request liên tục**: `POST /api/history` tốn ~130ms/lượt ở server (xác thực
  người dùng trong CSDL + truy vấn lịch sử). Trước đây effect ghi lịch sử phụ thuộc cả trạng thái phát/tạm
  dừng nên mỗi lần play/pause/chuyển bài/tua đều gửi thêm một request 0ms; nay chỉ gửi khi bài đã phát
  ≥ 5 giây, khi tiến thêm ≥ 30 giây, khi tạm dừng hoặc khi nghe hết — và mỗi lúc chỉ một request đang bay.
  Nhờ vậy thao tác chọn bài không còn bị xếp sau một hàng request ghi lịch sử (`npm run check:history`).
- Đo lại bằng `npm run bench` (cần server đang chạy) để xem thời gian từng trang.

### Bố cục trên điện thoại (tránh tràn ngang)

Lỗi thực tế đã gặp: ở màn hình ~360px, nội dung hero của trang chủ bị cắt giữa câu và nút CTA thứ hai
nằm ngoài màn hình. Nguyên nhân **không** nằm ở `overflow` của trang mà ở kích thước tối thiểu của
grid/flex item:

- Mặc định của grid/flex item là `min-width: auto` = **min-content** của phần tử con. Một con rộng
  (ví dụ hàng 2 nút CTA cạnh nhau ≈ 432px) sẽ **kéo cả cột rộng ra** khỏi khung, rồi bị
  `overflow-hidden` của hero cắt mất (nội dung trông như “mất chữ” chứ không sinh thanh cuộn ngang).
  → Luôn thêm `min-w-0` cho cột/ô chứa nội dung dài: `<div className="min-w-0 space-y-4">`.
- `flex-1` (tức `flex-basis: 0`) trong hàng `flex-wrap` **không** làm nút xuống dòng: nút chỉ được nới
  tới min-content rồi tràn ra ngoài. Trên điện thoại dùng `w-full` để xếp dọc
  (`h-11 w-full rounded-full sm:h-10 sm:w-auto`), từ `sm` mới để nút tự co theo nội dung.
- Tiêu đề shelf dùng `line-clamp-2 sm:line-clamp-none sm:truncate` để trên điện thoại xuống 2 dòng
  thay vì bị cắt (“Mới thêm vào thư…”).
- Văn bản dài trong thẻ (tên bài, ca sĩ, nguồn phát) cần `min-w-0` + `truncate` **ngay trên phần tử
  flex con**, nếu không nhãn sẽ đẩy tràn ra ngoài thẻ.
- **Chạm vào ô nhập liệu không làm trang phóng to**: iOS/Safari tự zoom khi ô được focus có
  `font-size` < 16px, nên `globals.css` đặt `font-size: 16px` cho ô nhập **chữ** trên màn hình ≤ 639px
  (loại trừ ô tick, nút radio, thanh trượt, bảng màu, nút bấm, ô chọn file). Rule này cố ý nằm **ngoài
  mọi `@layer`**: Tailwind v4 đưa utility vào `@layer utilities` còn CSS không layer luôn thắng — nếu đặt
  trong layer thì `text-xs` của các ô nhập sẽ vô hiệu hoá nó. Cũng cố ý **không** dùng `maximum-scale=1` /
  `userScalable: false` vì cách đó chặn luôn thao tác chụm 2 ngón tay để phóng to (người mắt kém không
  đọc được). Kiểm chứng bằng `npm run check:mobile`.

Cách kiểm tra nhanh (không cần điện thoại): mở DevTools → chọn bề rộng 320/360/390px. Lưu ý: chế độ
`--headless` cũ của Edge/Chrome có thể làm tròn `--window-size` lên bề rộng cửa sổ tối thiểu của
Windows, nên ảnh chụp sẽ là **ảnh cắt** của một layout rộng hơn — hãy đặt trang trong
`<iframe width="360">` rồi chụp ở cửa sổ rộng hơn, hoặc đo trực tiếp bằng
`element.getBoundingClientRect().right` so với `window.innerWidth`. `npm run check:theme` có các kiểm
tra tĩnh cho những quy tắc trên.

---

## 13. Giấy phép

Dự án nội bộ, phục vụ mục đích học tập và vận hành trong doanh nghiệp. Nội dung nhạc thuộc bản quyền
của các nền tảng/chủ sở hữu tương ứng; hệ thống chỉ nhúng qua trình phát chính thức.

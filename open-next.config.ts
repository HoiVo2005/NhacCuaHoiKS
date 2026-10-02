import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cau hinh OpenNext cho Cloudflare.
// Ban toi gian: khong bat incremental cache (app chu yeu render dong).
// Khi can ISR/cache ben vung, xem muc "Cache R2" trong HUONG-DAN-DEPLOY-CLOUDFLARE.md.
export default defineCloudflareConfig({});

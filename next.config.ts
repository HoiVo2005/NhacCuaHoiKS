import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cac package chi chay tren server (driver PostgreSQL) khong bundle bang Turbopack
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],

  // An hoan toan nut Dev Tools Indicator (chu "N") o goc man hinh khi chay next dev.
  // Loi compile/runtime van hien thi binh thuong.
  devIndicators: false,

  experimental: {
    // Giu cache phia client cho trang dong: quay lai trang vua xem trong 30s la hien ngay
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i1.sndcdn.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "**.tiktokcdn.com" },
      { protocol: "https", hostname: "**.tiktokcdn-us.com" },
      { protocol: "https", hostname: "**.ibytedtos.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack 関連の設定は削除
  experimental: {
    // turbo: false,  ← 削除
  },
};

module.exports = nextConfig;
// next.config.ts
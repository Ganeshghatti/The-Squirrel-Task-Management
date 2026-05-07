/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Baileys uses ws + optional native deps; bundling can break them
    serverComponentsExternalPackages: [
      "@whiskeysockets/baileys",
      "ws",
      "bufferutil",
      "utf-8-validate",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
      {
        protocol: "https",
        hostname: "yt3.googleusercontent.com",
      },
    ],
  },
};

module.exports = nextConfig


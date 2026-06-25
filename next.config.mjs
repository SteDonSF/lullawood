/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Local /public/art placeholders today; swap to a CDN/loader when art lands.
    formats: ["image/avif", "image/webp"],
  },
};
export default nextConfig;

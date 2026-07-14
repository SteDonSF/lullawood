/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
  },
  // Retired routes (Phase B honesty sweep): the dead waitlist/start flow is gone.
  // /start now points prospects at signup; /waitlist sends them home.
  async redirects() {
    return [
      { source: "/start", destination: "/signup", permanent: true },
      { source: "/waitlist", destination: "/", permanent: true },
    ];
  },
};
export default nextConfig;

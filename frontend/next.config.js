/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Don't block production builds on lint errors (demo deployment)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't block production builds on TS errors (demo deployment)
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;

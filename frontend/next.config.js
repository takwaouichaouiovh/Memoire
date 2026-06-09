/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "https://postie-backend.onrender.com";

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
    ];
  },
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "/api/proxy/:path*",
      },
    ];
  },
};

module.exports = nextConfig;

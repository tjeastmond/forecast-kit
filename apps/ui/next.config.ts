import type { NextConfig } from 'next';

const apiOrigin = process.env.FORCAST_KIT_API_URL ?? 'http://127.0.0.1:3847';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  rewrites() {
    return Promise.resolve([
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ]);
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const BACKEND_URL = process.env.REQUIREMENTS_BACKEND_URL || 'http://127.0.0.1:4315';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', 'rc-util', 'rc-pagination', 'rc-picker'],
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons', 'recharts']
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`
      }
    ];
  }
};

export default config;
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // 允许 API 路由处理大文件上传
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default config;

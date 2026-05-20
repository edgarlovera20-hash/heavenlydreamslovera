/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  },
  experimental: {},
  transpilePackages: ['@heavenly/ui', '@heavenly/types', '@heavenly/shared'],
};

export default nextConfig;

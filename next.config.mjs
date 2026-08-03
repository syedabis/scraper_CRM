/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3001', '*.devtunnels.ms'],
    },
  },
};

export default nextConfig;

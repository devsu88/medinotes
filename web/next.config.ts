import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export', // static HTML/JS, served by the FastAPI container
  images: { unoptimized: true },
};

export default nextConfig;

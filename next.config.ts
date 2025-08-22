import type { NextConfig } from "next";

// @ts-ignore - next-pwa doesn't have TypeScript definitions
const withPWA = require('next-pwa');

const nextConfig: NextConfig = {
  output: 'export', // Enable static export for Firebase Hosting
  trailingSlash: true, // Add trailing slashes for better static hosting
  images: {
    unoptimized: true // Disable image optimization for static export
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    }
  },
  eslint: {
    ignoreDuringBuilds: true // Ignore ESLint errors during builds
  }
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
})(nextConfig);

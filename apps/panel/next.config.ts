import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@healthpanel/shared'],
  experimental: {
    // Enable optimized package imports for common libraries
    optimizePackageImports: ['recharts'],
  },
}

export default nextConfig

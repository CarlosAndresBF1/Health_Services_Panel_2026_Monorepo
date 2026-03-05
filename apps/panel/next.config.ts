import type { NextConfig } from 'next'

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3045'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@healthpanel/shared'],
  experimental: {
    // Enable optimized package imports for common libraries
    optimizePackageImports: ['recharts'],
  },
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${API_INTERNAL_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig

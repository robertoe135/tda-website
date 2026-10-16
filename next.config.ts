import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  // Career applications carry a CV of up to 4 MB; Vercel refuses requests over 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: '4.4mb' } },
  // Old Squarespace addresses of the menu pages. Project addresses are handled separately.
  redirects: async () => [
    { source: '/about-5', destination: '/about', permanent: true },
    { source: '/team', destination: '/about/team', permanent: true },
    { source: '/team/:slug', destination: '/about/team/:slug', permanent: true },
    { source: '/collaborators', destination: '/about/collaborators', permanent: true },
  ],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })

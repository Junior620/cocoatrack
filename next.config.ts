import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Experimental features for Next.js 15
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Optimize package imports for better tree-shaking
    // Task 24.3: Bundle size optimization
    optimizePackageImports: [
      'recharts',
      'mapbox-gl',
      'react-map-gl',
      'gsap',
      'leaflet',
      'react-leaflet',
      'lucide-react',
      'date-fns',
      '@turf/turf',
      'jspdf',
      'xlsx',
    ],
    // Task 6.4.4: Code splitting for satellite features
    // Separate satellite feature code into its own chunk
    optimizeCss: true,
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
    // Optimize image formats - Task 24.2
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Image sizes for srcset
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_APP_NAME: 'CocoaTrack V2',
    NEXT_PUBLIC_APP_VERSION: '2.0.0',
  },

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Enable gzip compression
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // Power by header (disable for security)
  poweredByHeader: false,

  // Modular imports for smaller bundles
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // Turbopack configuration (empty to silence Next.js 16 warning)
  // This allows webpack config to coexist with Turbopack
  turbopack: {},

  // Webpack configuration for code splitting
  webpack: (config, { isServer }) => {
    // Task 6.4.4: Code splitting for satellite features
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Separate satellite feature code into its own chunk
            satellite: {
              test: /[\\/](components|hooks|lib)[\\/]satellite[\\/]/,
              name: 'satellite',
              chunks: 'async',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Separate map libraries into their own chunk
            maps: {
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet|mapbox-gl|react-map-gl)[\\/]/,
              name: 'maps',
              chunks: 'async',
              priority: 9,
              reuseExistingChunk: true,
            },
            // Separate chart libraries into their own chunk
            charts: {
              test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
              name: 'charts',
              chunks: 'async',
              priority: 8,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },

  // Headers for service worker and caching
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      // Cache static assets
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache images
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // Cache videos
      {
        source: '/:path*.mp4',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
          {
            key: 'Content-Type',
            value: 'video/mp4',
          },
        ],
      },
      // Security headers
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

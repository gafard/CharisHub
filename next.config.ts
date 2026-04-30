import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    '/api/strong': ['./data/strong.sqlite'],
    '/api/treasury': ['./data/treasury.sqlite'],
    '/api/matthew-henry': ['./data/matthew_henry.sqlite'],
    '/api/nave': ['./data/nave.sqlite'],
    '/api/sqlite/health': ['./data/*.sqlite'],
  },
};

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);

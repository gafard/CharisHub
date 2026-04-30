import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'build/**',
      'out/**',
      'node_modules/**',
      'public/sw.js',
      'public/workbox-*.js',
      'public/worker-*.js',
      'next-env.d.ts',
    ],
  },
];

export default config;

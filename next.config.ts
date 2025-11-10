import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript type checking during builds (optional)
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude .d.ts files from being processed by webpack
    config.module.rules.push({
      test: /\.d\.ts$/,
      use: 'ignore-loader',
    });

    return config;
  },
  // Transpile rate-limiter-flexible to fix build issues
  transpilePackages: ['rate-limiter-flexible'],
};

export default nextConfig;

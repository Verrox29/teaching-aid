import type { NextConfig } from 'next';

import { SERVER_ACTION_BODY_SIZE_LIMIT } from './src/lib/group-submission';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: SERVER_ACTION_BODY_SIZE_LIMIT
    }
  },
  output: 'standalone'
};

export default nextConfig;

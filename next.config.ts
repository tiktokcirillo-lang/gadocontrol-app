import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/app',
        destination: '/',
        permanent: false,
      },
      {
        source: '/app/:path*',
        destination: '/:path*',
        permanent: false,
      },
    ];
  },
};

export default withSerwist(nextConfig);

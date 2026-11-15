/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./public/data/November 2026 Shutdown.xlsx"],
  },
};

export default nextConfig;

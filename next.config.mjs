/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./Master App Timesheet.xlsx"],
  },
};

export default nextConfig;

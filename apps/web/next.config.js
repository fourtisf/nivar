/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile the shared config package (TS source) so both dev + build work
  // without a separate prebuild step.
  transpilePackages: ["@nivar/config"],
};

module.exports = nextConfig;

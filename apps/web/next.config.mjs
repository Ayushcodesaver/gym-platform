/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gym/constants", "@gym/types", "@gym/validation", "@gym/api-client"],
};

export default nextConfig;

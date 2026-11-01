/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; load it from node_modules instead of bundling it.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // WordPress database dumps are uploaded through a server action.
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default nextConfig;

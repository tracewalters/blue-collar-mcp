import type { NextConfig } from "next";

// Dashboard API lives on the hosted MCP server (src/server.ts). Same origin via proxy.
const api = process.env.BCMCP_API ?? "http://127.0.0.1:3300";

const config: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/auth/:path*", destination: `${api}/auth/:path*` },
    ];
  },
};
export default config;

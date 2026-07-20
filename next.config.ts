import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // standalone tylko gdy jawnie włączone (VPS). Vercel / CloudLinux = zwykły build.
  ...(process.env.STANDALONE_BUILD === "1" ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["postgres", "@neondatabase/serverless"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

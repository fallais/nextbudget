import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeORM and the pg driver are CommonJS with optional driver requires
  // (expo-sqlite, mongodb, …). Keep them external so webpack doesn't try to
  // bundle/resolve those optional deps; they're require()d at runtime.
  serverExternalPackages: ["typeorm", "pg", "reflect-metadata"],
};

export default nextConfig;

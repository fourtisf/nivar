/**
 * PM2 process config for NIVAR (Hostinger VPS, handoff §2).
 * From the repo root on the server:
 *   pm2 startOrReload deploy/ecosystem.config.cjs --update-env
 *   pm2 save
 *
 * Secrets (JWT_SECRET, DATABASE_URL, REDIS_URL, …) must be provided via the
 * environment — export them in the shell before `pm2 ... --update-env`, or copy
 * this file to ecosystem.local.cjs (gitignored) and fill the env blocks there.
 * NEVER commit secrets.
 */
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "nivar-web",
      cwd: path.join(ROOT, "apps/web"),
      script: "npm",
      args: "run start -- -p 3000",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production", PORT: "3000" },
    },
    {
      name: "nivar-api",
      cwd: path.join(ROOT, "apps/api"),
      script: "npm",
      args: "run start",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
        // Required (api refuses to boot in prod without a strong secret):
        JWT_SECRET: process.env.JWT_SECRET || "",
        // Persistence + cache (used once the Prisma store / Redis lock land):
        DATABASE_URL: process.env.DATABASE_URL || "",
        REDIS_URL: process.env.REDIS_URL || "",
      },
    },
  ],
};
